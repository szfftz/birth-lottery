// 搖獎機的物理（位置式 Verlet，座標以滾筒中心為原點；場景單位：球的直徑＝1）：滾筒（擋板、筒壁摩擦、出球口）、滑道、盤子、球跟球互撞。
// 只算數字（不畫東西）；LotteryDrum.vue 照這裡的位置畫球，照 omega／angle 轉滾筒
import { BALL_R as R } from './ball3d.js'

// 搖獎機（場景單位：球的直徑＝1）：滾筒的軸是前後方向（z），內半徑 DRUM.r、深 DRUM.d，軸心高 DRUM.y
export const DRUM = { r: 11, d: 7, y: 14.5 }
export const BASE = { h: 0.8 } // 展示台上層的頂面高（球掉出來的地面）
// 重力（場景單位／秒²）：一顆球直徑當 4 公分，真的重力 9.8 m/s² ≈ 245 單位／秒²；用 200，速度跟真的搖獎機差不多
export const G = 200
export const SUB = 4 // 每一格畫面分幾小步算（重力大，步子要小才穩）
// 轉速：ω²r 要比 g 小，球才不會被甩在筒壁上（ω < √(g/r) ≈ 4.3 弧度／秒）
export const SPIN = { w: 3.4, sec: 3.5, ramp: 0.8, alignW: 3 } // 轉的角速度、轉幾秒（每次再乘 0.85～1.15 的亂數＝搖的力道不一樣）、加減速秒數、對準出球口時的角速度
export const WALL_FRICTION = 0.35 // 球碰到筒壁時，切線速度往筒壁速度靠多少（摩擦）
// 擋板：從筒壁往裡伸的三片板子，跟著滾筒轉，把球帶上去
// a0：第一片擋板的角度；出球口朝下時三片在 −30°、−150°、90°（都是斜的或朝上），不會有一片剛好水平、讓球停在上面
export const FINS = { n: 3, len: 1.6, t: 0.15, a0: Math.PI / 2 }
// 出球口：筒壁上靠前面的一個方洞（寬 HOLE.w、在 z 方向從前面的圓板往後 HOLE.d），角度 HOLE.a 是滾筒沒轉時的位置
export const HOLE = { a: Math.PI / 6, w: 1.5, d: 1.5 }
// 滑道：球從出球口掉下來，球心沿著 A → B 這條斜線滾到盤子；盤子是透明淺盒
export const CHUTE = { z0: DRUM.d / 2 - HOLE.d / 2, y0: DRUM.y - DRUM.r - 0.4, z1: DRUM.d / 2 + 4.2, y1: BASE.h + 1.1 + R + 0.15, w: 1.4 }
export const TRAY = { z: DRUM.d / 2 + 6, w: 5, d: 3.6, h: 0.7 }

// 角度差（−π～π）
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a))

/** n 顆球的模擬。回傳的 sim：px…oz＝現在、上一步的位置；where[b]＝0 在滾筒裡、1 掉出來了；
 *  omega＝滾筒角速度、angle＝滾筒轉了多少、gateOpen＝出球口打開、escaped＝這次掉出去的球、moving＝還有球在動 */
export function createDrumSim(n) {
  const sim = { omega: 0, angle: 0, gateOpen: false, moving: true, escaped: -1, iters: 4 } // iters＝每一小步解幾輪碰撞（慢的手機降到 2）
  const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n)
  const ox = new Float32Array(n), oy = new Float32Array(n), oz = new Float32Array(n)
  // 每顆球在哪：0＝滾筒裡、1＝掉出來（滑道、盤子）
  const where = new Uint8Array(n)
  let seed = 25
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

  // 鄰居格子：一格 1（球直徑），counting sort 排好
  const NX = 2 * DRUM.r + 4, NY = NX, NZ = DRUM.d + 4
  const OFF = DRUM.r + 2
  const cellStart = new Int32Array(NX * NY * NZ + 1), cellItem = new Int32Array(n), cellOfBall = new Int32Array(n)
  const clampI = (v, m) => Math.min(m - 1, Math.max(0, v))
  const cellIdx = (x, y, z) => (clampI(Math.floor(z + DRUM.d / 2 + 2), NZ) * NY + clampI(Math.floor(y + OFF), NY)) * NX + clampI(Math.floor(x + OFF), NX)
  const cellFill = new Int32Array(cellStart.length) // 排序用的暫存（重複用，不要每次 new：手機上會一直回收記憶體、卡一下）
  function buildGrid() {
    cellStart.fill(0)
    for (let b = 0; b < n; b++) { const c = cellIdx(px[b], py[b], pz[b]); cellOfBall[b] = c; cellStart[c + 1]++ }
    for (let c = 0; c < cellStart.length - 1; c++) cellStart[c + 1] += cellStart[c]
    cellFill.set(cellStart)
    for (let b = 0; b < n; b++) cellItem[cellFill[cellOfBall[b]]++] = b
  }
  // 球跟球互撞：每一對球只看一次——自己那一格（編號比自己大的）、同一列右邊那格，加上「後面」4 列（同一層的下一列、下一層的三列）各左右三格。
  // 同一列左右三格在 cellItem 裡是連在一起的，所以一次掃一段：總共 5 段（約 14 格），不用把旁邊 26 格都看過再丟掉一半
  // 格子每一步只排一次（rebuild），同一步裡後面幾輪沿用：一輪裡球移動遠小於一格，旁邊的格子一定涵蓋得到
  const ROWS = [[1, 0], [-1, 1], [0, 1], [1, 1]] // [dj, dk]：後面那 4 列
  function hit(b, q, qEnd, wb) {
    for (; q < qEnd; q++) {
      const o = cellItem[q]
      if (where[o] !== wb) continue // 滾筒裡、外的球隔著筒壁，不會互撞（掉出來的球不會被筒裡的球卡住）
      const ex = px[o] - px[b], ey = py[o] - py[b], ez = pz[o] - pz[b]
      const d2 = ex * ex + ey * ey + ez * ez
      if (d2 >= 1 || d2 === 0) continue
      const d = Math.sqrt(d2), push = (1 - d) / 2 / d
      px[b] -= ex * push; py[b] -= ey * push; pz[b] -= ez * push
      px[o] += ex * push; py[o] += ey * push; pz[o] += ez * push
    }
  }
  function collideBalls(rebuild) {
    if (rebuild) buildGrid()
    // 照格子的順序一顆一顆看（cellItem 的順序）：同一格裡排在自己後面的球＝還沒配過的
    for (let p = 0; p < n; p++) {
      const b = cellItem[p], c = cellOfBall[b], wb = where[b]
      const ci = c % NX, cj = ((c / NX) | 0) % NY, ck = (c / (NX * NY)) | 0
      hit(b, p + 1, cellStart[ci < NX - 1 ? c + 2 : c + 1], wb) // 自己這格剩下的＋右邊那格
      const i0 = ci > 0 ? ci - 1 : 0, i1 = ci < NX - 1 ? ci + 1 : NX - 1
      for (let r = 0; r < 4; r++) {
        const j = cj + ROWS[r][0], k = ck + ROWS[r][1]
        if (j < 0 || j >= NY || k >= NZ) continue
        const row = (k * NY + j) * NX
        hit(b, cellStart[row + i0], cellStart[row + i1 + 1], wb)
      }
    }
  }
  // 滾筒裡的球：筒壁（摩擦）、前後圓板、擋板；出球口打開時，球心對準洞口的球可以穿過筒壁
  const finCos = new Float64Array(FINS.n), finSin = new Float64Array(FINS.n)
  function drumConstraints(h, first) {
    const rMax = DRUM.r - R, zMax = DRUM.d / 2 - R
    const holeA = HOLE.a + sim.angle
    for (let f = 0; f < FINS.n; f++) { const a = sim.angle + FINS.a0 + (f / FINS.n) * Math.PI * 2; finCos[f] = Math.cos(a); finSin[f] = Math.sin(a) } // 擋板方向：每一輪算一次
    for (let b = 0; b < n; b++) {
      if (where[b]) continue
      let d = Math.hypot(px[b], py[b])
      // 擋板：從筒壁往中心伸 FINS.len 的線段，球碰到就推開，並帶著板子的速度
      for (let f = 0; f < FINS.n; f++) {
        const ca = finCos[f], sa = finSin[f]
        const along = px[b] * ca + py[b] * sa // 沿著板子方向的距離（離中心）
        if (along < DRUM.r - FINS.len || along > DRUM.r) continue
        const perp = -px[b] * sa + py[b] * ca // 離板子多遠（正負＝在哪一邊）
        const need = R + FINS.t / 2
        if (Math.abs(perp) >= need) continue
        const push = (need - Math.abs(perp)) * Math.sign(perp || 1)
        px[b] += -sa * push; py[b] += ca * push
        // 板子在動：球垂直板子方向的速度變成跟板子一樣（板子推著球走），沿著板子的速度不變
        if (first && sim.omega) {
          const vFin = sim.omega * along * h
          const vCur = (px[b] - ox[b]) * -sa + (py[b] - oy[b]) * ca
          if ((push > 0 && vFin > vCur) || (push < 0 && vFin < vCur)) { ox[b] -= -sa * (vFin - vCur); oy[b] -= ca * (vFin - vCur) }
        }
      }
      d = Math.hypot(px[b], py[b])
      if (d > rMax) {
        const inHole = sim.gateOpen && Math.abs(wrapA(Math.atan2(py[b], px[b]) - holeA)) * DRUM.r < (HOLE.w / 2 - R) + 0.25 && pz[b] > DRUM.d / 2 - HOLE.d + R - 0.1
        if (inHole && sim.escaped < 0) {
          // 穿過洞口：球心超過筒壁就算掉出去了（之後在滑道上算）
          if (d > DRUM.r + R) { where[b] = 1; sim.escaped = b; sim.gateOpen = false }
          continue
        }
        px[b] *= rMax / d; py[b] *= rMax / d
        // 筒壁摩擦：切線方向的速度往筒壁的速度靠
        if (first) {
          const tx = -py[b] / rMax, ty = px[b] / rMax
          const vx = px[b] - ox[b], vy = py[b] - oy[b]
          const vt = vx * tx + vy * ty, wall = sim.omega * DRUM.r * h
          const dv = (wall - vt) * WALL_FRICTION
          ox[b] -= tx * dv; oy[b] -= ty * dv
        }
      }
      pz[b] = Math.max(-zMax, Math.min(zMax, pz[b]))
    }
  }
  // 掉出來的球：滑道（斜線，左右有邊）、盤子（淺盒）、地面；座標一樣以滾筒中心為原點
  const CHUTE_PUSH = 14 // 滑道上往前的額外加速度（場景單位／秒²）
  const toW = (y) => y + DRUM.y // 滾筒座標 → 世界座標的 y
  function outsideConstraints(b) {
    const wy = toW(py[b])
    // 滑道：球心不能低於 A → B 這條線（z 在滑道範圍內）
    if (pz[b] >= CHUTE.z0 - 1 && pz[b] <= CHUTE.z1) {
      const t = Math.max(0, (pz[b] - CHUTE.z0) / (CHUTE.z1 - CHUTE.z0))
      const yLine = CHUTE.y0 + (CHUTE.y1 - CHUTE.y0) * t
      if (wy < yLine) py[b] += yLine - wy
      px[b] = Math.max(-CHUTE.w / 2 + R, Math.min(CHUTE.w / 2 - R, px[b]))
    }
    // 盤子：底、四邊
    const floor = BASE.h + 0.14 + R
    if (toW(py[b]) < floor) py[b] = floor - DRUM.y
    if (pz[b] > CHUTE.z1) {
      px[b] = Math.max(-TRAY.w / 2 + R, Math.min(TRAY.w / 2 - R, px[b]))
      pz[b] = Math.min(TRAY.z + TRAY.d / 2 - R, pz[b])
      // 盤子底有摩擦：慢慢停下來
      if (toW(py[b]) < floor + 0.01) { ox[b] += (px[b] - ox[b]) * 0.05; oz[b] += (pz[b] - oz[b]) * 0.05 }
    }
  }
  function step(h) {
    const damp = 0.9995, gh = G * h * h // 空氣阻力很小
    let maxV = 0
    for (let b = 0; b < n; b++) {
      const vx = (px[b] - ox[b]) * damp, vy = (py[b] - oy[b]) * damp, vz = (pz[b] - oz[b]) * damp
      maxV = Math.max(maxV, Math.abs(vx), Math.abs(vy), Math.abs(vz))
      ox[b] = px[b]; oy[b] = py[b]; oz[b] = pz[b]
      px[b] += vx; py[b] += vy - gh; pz[b] += vz
      // 滑道上多推一把（像滑道有點陡又很滑），球滾出來快一點
      if (where[b] && pz[b] >= CHUTE.z0 - 1 && pz[b] <= CHUTE.z1) pz[b] += CHUTE_PUSH * h * h
    }
    for (let it = 0; it < sim.iters; it++) {
      collideBalls(it === 0)
      drumConstraints(h, it === 0)
      for (let b = 0; b < n; b++) if (where[b]) outsideConstraints(b)
    }
    return maxV / h // 最快的球多快（場景單位／秒）
  }
  // 一開始：球亂放在滾筒裡，掉下來堆在底部
  // preset＝預先算好的位置（scripts/build_settled.mjs 產生的 { n, xyz }）：球數對得上就直接用，不用現場跑 600 步（手機上會卡 1～3 秒）
  function initBalls(preset) {
    if (preset?.n === n && preset.xyz?.length === n * 3) {
      for (let b = 0; b < n; b++) { px[b] = ox[b] = preset.xyz[b * 3]; py[b] = oy[b] = preset.xyz[b * 3 + 1]; pz[b] = oz[b] = preset.xyz[b * 3 + 2] }
      return
    }
    for (let b = 0; b < n; b++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (DRUM.r - 1)
      px[b] = ox[b] = Math.cos(a) * r
      py[b] = oy[b] = -Math.abs(Math.sin(a) * r) * 0.6
      pz[b] = oz[b] = (rand() - 0.5) * (DRUM.d - 1)
    }
    for (let s = 0; s < 600; s++) step(1 / 240)
  }

  // 盤子上的球放回滾筒：從滾筒上面掉進去
  function putBack(b) {
    where[b] = 0
    px[b] = ox[b] = (rand() - 0.5) * 3; py[b] = oy[b] = DRUM.r * 0.5; pz[b] = oz[b] = (rand() - 0.5) * (DRUM.d - 2)
  }
  // 直接把球放進盤子正中間
  function placeInTray(b) {
    where[b] = 1
    px[b] = ox[b] = 0; py[b] = oy[b] = BASE.h + 0.14 + R - DRUM.y; pz[b] = oz[b] = TRAY.z
  }
  // 球還在動嗎：回傳「從上次呼叫到現在，位置變最多的那顆球移了多遠」。
  // 不能看速度：堆好的球每一小步還是被重力拉一點再推回來，速度一直在抖、不會變 0；但位置其實沒變
  const sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n)
  function drift() {
    let m = 0
    for (let b = 0; b < n; b++) {
      const d = Math.abs(px[b] - sx[b]) + Math.abs(py[b] - sy[b]) + Math.abs(pz[b] - sz[b])
      if (d > m) m = d
      sx[b] = px[b]; sy[b] = py[b]; sz[b] = pz[b]
    }
    return m
  }
  // 停下來：速度歸零（下次再算時不會彈一下）
  function rest() { ox.set(px); oy.set(py); oz.set(pz); sim.moving = false }
  return Object.assign(sim, { px, py, pz, ox, oy, oz, where, rand, step, initBalls, putBack, placeInTray, drift, rest })
}
