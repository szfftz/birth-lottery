<template>
  <!-- 遊戲模式：891 顆彩球放進透明的樂透搖獎機（3D 圓滾筒）。按「抽一次」滾筒轉起來，筒裡的擋板把球帶上去再翻下來；
       停下來後滾筒慢慢轉到出球口朝下、打開閘門，哪一顆球靠重力掉出去就是抽到的，沿著滑道滾進前面的盤子（全部照物理模擬） -->
  <!-- 整個舞台 4:5（外層 .lottery-drum 決定大小）：舞台背景（CSS）→ 3D 搖獎機（透明畫布）→ 節目標題、結果看板（slot）、彩帶；文字類用 1080×1350 設計再縮放 -->
  <div ref="wrap" class="lottery-drum">
    <div class="stage" :style="{ left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` }">
      <div class="stage-bg"><div class="rays"></div><div class="beam l"></div><div class="beam r"></div><div class="floor"></div></div>
      <!-- 手機：點一下球看是哪一國（拖曳＝轉鏡頭，不算點）；電腦：滑過去就看 -->
      <div ref="glBox" class="stage-gl" @pointerdown="onDown" @pointerup="onUp" @pointermove="onMove" @pointerleave="onLeave"></div>
      <div class="stage-ui" :style="{ transform: `scale(${box.h / 1350})` }">
        <!-- 整個舞台外圈的跑馬燈：按 DRAW 搖獎時快速轉、中獎後慢慢轉 -->
        <div v-if="spinning || sel != null" class="marquee" :class="{ fast: spinning }"><i class="mt"></i><i class="mr"></i><i class="mb"></i><i class="ml"></i></div>
        <div class="show-title">
          <div class="st-bulbs"></div>
          <div class="st-zh">BIRTH LOTTERY!</div>
          <div class="st-sub">{{ balls.n.toLocaleString() }} BALLS · {{ balls.isos.length }} COUNTRIES · COME ON DOWN!</div>
        </div>
        <!-- 觀眾：按 DRAW 之後舞台下面一排排人影舉手拍手（前後兩排、每個人節奏不一樣） -->
        <svg v-if="spinning || sel != null" class="crowd" viewBox="0 0 1080 260" preserveAspectRatio="none">
          <g v-for="(row, ri) in CROWD" :key="ri" :class="`row r${ri}`">
            <g v-for="(m, k) in row" :key="k" class="fan" :style="{ animationDelay: `${m.d}s`, animationDuration: `${m.t * 2}s` }">
              <path class="arm" :d="`M${m.x - 15 * m.s},${260 - 52 * m.s} L${m.x - 5 * m.s},${260 - 122 * m.s}`" :stroke-width="10 * m.s"
                :style="{ transformOrigin: `${m.x - 15 * m.s}px ${260 - 52 * m.s}px`, animationDelay: `${m.d}s`, animationDuration: `${m.t}s` }" />
              <path class="arm r" :d="`M${m.x + 15 * m.s},${260 - 52 * m.s} L${m.x + 5 * m.s},${260 - 122 * m.s}`" :stroke-width="10 * m.s"
                :style="{ transformOrigin: `${m.x + 15 * m.s}px ${260 - 52 * m.s}px`, animationDelay: `${m.d}s`, animationDuration: `${m.t}s` }" />
              <path :d="`M${m.x - 30 * m.s},260 Q${m.x - 30 * m.s},${260 - 62 * m.s} ${m.x},${260 - 64 * m.s} Q${m.x + 30 * m.s},${260 - 62 * m.s} ${m.x + 30 * m.s},260 Z`" />
              <circle :cx="m.x" :cy="260 - 84 * m.s" :r="17 * m.s" />
            </g>
          </g>
        </svg>
        <div class="show-board"><slot /></div>
        <!-- 舞台上的大按鈕：跟工具列的「抽一次」一樣；按下去搖獎時藏起來，抽完再出現 -->
        <button v-if="!spinning" type="button" class="show-btn" @click="emit('draw')">
          <span class="sb-dome"><b>{{ spinning ? 'ROLL…' : 'DRAW' }}</b></span>
        </button>
        <div v-if="pieces.length" :key="party" class="confetti">
          <i v-for="(c, i) in pieces" :key="i" :style="c"></i>
        </div>
      </div>
      <div v-if="tip" class="drum-tip" :style="tipPos" v-html="tip.html"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { BALL_R as R, makeBallMesh, setBallFace } from '../lib/ball3d.js'

const props = defineProps({
  balls: { type: Object, required: true }, // loadBalls() 的結果
  colors: { type: Object, required: true }, // 每國球的顏色（獎項色）
  atlas: { type: Object, default: null }, // 國旗拼圖
  grid: { type: Array, default: () => [1, 1] },
  face: { type: String, default: 'prize' }, // prize＝獎項色、flag＝國旗
  sel: { type: Number, default: null }, // 打開時盤子裡要放哪一顆（上一次抽到的）
  tipOf: { type: Function, required: true }, // 第 b 顆球的 tooltip（HTML）
  bg: { type: String, default: '#ffffff' },
  party: { type: Number, default: 0 }, // 換一個數字（每次公布結果）就灑一次彩帶
  spinning: { type: Boolean, default: false }, // 搖獎中（舞台上的按鈕不能按）
})
const emit = defineEmits(['draw'])
// 觀眾人影：後排小、前排大，位置、拍手快慢、起拍時間用固定的亂數（每次看起來一樣）
const CROWD = (() => {
  let seed = 25
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return [[15, 0.95, 0], [12, 1.3, 40]].map(([n, s, off]) => Array.from({ length: n }, (_, i) => ({
    x: off + (i + 0.5) * ((1080 - off) / n) + (rnd() - 0.5) * 30, s: s * (0.9 + rnd() * 0.2), d: -rnd(), t: 0.28 + rnd() * 0.14,
  })))
})()

// 搖獎機（場景單位：球的直徑＝1）：滾筒的軸是前後方向（z），內半徑 DRUM.r、深 DRUM.d，軸心高 DRUM.y
const DRUM = { r: 11, d: 7, y: 14.5 }
const BASE = { h: 0.8 } // 展示台上層的頂面高（球掉出來的地面）
const ACRYLIC = '#e8f4ff'
// 重力（場景單位／秒²）：一顆球直徑當 4 公分，真的重力 9.8 m/s² ≈ 245 單位／秒²；用 200，速度跟真的搖獎機差不多
const G = 200
const CAM = { az: 28, el: 22, dist: 100 } // 預設鏡頭：方位（往右幾度）、仰角、距離
const VIEW_UP = 0.1 // 3D 畫面往上移幾成畫面高：上面是節目標題、下面是結果看板
const SUB = 4 // 每一格畫面分幾小步算（重力大，步子要小才穩）
// 轉速：ω²r 要比 g 小，球才不會被甩在筒壁上（ω < √(g/r) ≈ 4.3 弧度／秒）
const SPIN = { w: 3.4, sec: 6, ramp: 0.8, alignW: 3 } // 轉的角速度、轉幾秒（每次再乘 0.85～1.15 的亂數＝搖的力道不一樣）、加減速秒數、對準出球口時的角速度
const WALL_FRICTION = 0.35 // 球碰到筒壁時，切線速度往筒壁速度靠多少（摩擦）
// 擋板：從筒壁往裡伸的三片板子，跟著滾筒轉，把球帶上去
// a0：第一片擋板的角度；出球口朝下時三片在 −30°、−150°、90°（都是斜的或朝上），不會有一片剛好水平、讓球停在上面
const FINS = { n: 3, len: 1.6, t: 0.15, a0: Math.PI / 2 }
// 出球口：筒壁上靠前面的一個方洞（寬 HOLE.w、在 z 方向從前面的圓板往後 HOLE.d），角度 HOLE.a 是滾筒沒轉時的位置
const HOLE = { a: Math.PI / 6, w: 1.5, d: 1.5 }
// 滑道：球從出球口掉下來，球心沿著 A → B 這條斜線滾到盤子；盤子是透明淺盒
const CHUTE = { z0: DRUM.d / 2 - HOLE.d / 2, y0: DRUM.y - DRUM.r - 0.4, z1: DRUM.d / 2 + 4.2, y1: BASE.h + 0.7 + R + 0.15, w: 1.4 }
const TRAY = { z: DRUM.d / 2 + 6, w: 5, d: 3.6, h: 0.7 }

const wrap = ref(null), glBox = ref(null)
const box = reactive({ x: 0, y: 0, w: 0, h: 0 }) // 舞台的範圍（整個元件）
const tip = ref(null)
// 說明框不要超出舞台：靠右、靠下時翻到手指的另一邊
const tipPos = computed(() => {
  const t = tip.value, right = t.x > box.w * 0.55, below = t.y < box.h * 0.6
  return { [right ? 'right' : 'left']: `${right ? box.w - t.x + 12 : t.x + 12}px`, [below ? 'top' : 'bottom']: `${below ? t.y + 12 : box.h - t.y + 12}px` }
})
let renderer, scene, camera, controls, mesh, rot, gate, ro, raf = 0

// ── 球的模擬（位置式 Verlet，座標以滾筒中心為原點）──
const n = props.balls.n
const px = new Float32Array(n), py = new Float32Array(n), pz = new Float32Array(n)
const ox = new Float32Array(n), oy = new Float32Array(n), oz = new Float32Array(n)
// 每顆球在哪：0＝滾筒裡、1＝掉出來（滑道、盤子）
const where = new Uint8Array(n)
let omega = 0 // 滾筒角速度（弧度／秒）
let angle = 0 // 滾筒轉了多少
let gateOpen = false
let moving = true // 有沒有球還在動（都停了就不用算）
let seed = 25
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

// 鄰居格子：一格 1（球直徑），counting sort 排好
const NX = 2 * DRUM.r + 4, NY = NX, NZ = DRUM.d + 4
const OFF = DRUM.r + 2
const cellStart = new Int32Array(NX * NY * NZ + 1), cellItem = new Int32Array(n), cellOfBall = new Int32Array(n)
const clampI = (v, m) => Math.min(m - 1, Math.max(0, v))
const cellIdx = (x, y, z) => (clampI(Math.floor(z + DRUM.d / 2 + 2), NZ) * NY + clampI(Math.floor(y + OFF), NY)) * NX + clampI(Math.floor(x + OFF), NX)
function buildGrid() {
  cellStart.fill(0)
  for (let b = 0; b < n; b++) { const c = cellIdx(px[b], py[b], pz[b]); cellOfBall[b] = c; cellStart[c + 1]++ }
  for (let c = 0; c < cellStart.length - 1; c++) cellStart[c + 1] += cellStart[c]
  const fill = cellStart.slice()
  for (let b = 0; b < n; b++) cellItem[fill[cellOfBall[b]]++] = b
}
function collideBalls() {
  buildGrid()
  for (let b = 0; b < n; b++) {
    const c = cellOfBall[b], ci = c % NX, cj = Math.floor(c / NX) % NY, ck = Math.floor(c / (NX * NY))
    for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, k = ck + dk
      if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) continue
      const cc = (k * NY + j) * NX + i
      for (let q = cellStart[cc]; q < cellStart[cc + 1]; q++) {
        const o = cellItem[q]
        if (o <= b) continue
        const ex = px[o] - px[b], ey = py[o] - py[b], ez = pz[o] - pz[b]
        const d2 = ex * ex + ey * ey + ez * ez
        if (d2 >= 1 || d2 === 0) continue
        const d = Math.sqrt(d2), push = (1 - d) / 2 / d
        px[b] -= ex * push; py[b] -= ey * push; pz[b] -= ez * push
        px[o] += ex * push; py[o] += ey * push; pz[o] += ez * push
      }
    }
  }
}
// 角度差（−π～π）
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a))
// 滾筒裡的球：筒壁（摩擦）、前後圓板、擋板；出球口打開時，球心對準洞口的球可以穿過筒壁
let escaped = -1 // 這次掉出去的球
function drumConstraints(h, first) {
  const rMax = DRUM.r - R, zMax = DRUM.d / 2 - R
  const holeA = HOLE.a + angle
  for (let b = 0; b < n; b++) {
    if (where[b]) continue
    let d = Math.hypot(px[b], py[b])
    // 擋板：從筒壁往中心伸 FINS.len 的線段，球碰到就推開，並帶著板子的速度
    for (let f = 0; f < FINS.n; f++) {
      const a = angle + FINS.a0 + (f / FINS.n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a)
      const along = px[b] * ca + py[b] * sa // 沿著板子方向的距離（離中心）
      if (along < DRUM.r - FINS.len || along > DRUM.r) continue
      const perp = -px[b] * sa + py[b] * ca // 離板子多遠（正負＝在哪一邊）
      const need = R + FINS.t / 2
      if (Math.abs(perp) >= need) continue
      const push = (need - Math.abs(perp)) * Math.sign(perp || 1)
      px[b] += -sa * push; py[b] += ca * push
      // 板子在動：球垂直板子方向的速度變成跟板子一樣（板子推著球走），沿著板子的速度不變
      if (first && omega) {
        const vFin = omega * along * h
        const vCur = (px[b] - ox[b]) * -sa + (py[b] - oy[b]) * ca
        if ((push > 0 && vFin > vCur) || (push < 0 && vFin < vCur)) { ox[b] -= -sa * (vFin - vCur); oy[b] -= ca * (vFin - vCur) }
      }
    }
    d = Math.hypot(px[b], py[b])
    if (d > rMax) {
      const inHole = gateOpen && Math.abs(wrapA(Math.atan2(py[b], px[b]) - holeA)) * DRUM.r < (HOLE.w / 2 - R) + 0.25 && pz[b] > DRUM.d / 2 - HOLE.d + R - 0.1
      if (inHole && escaped < 0) {
        // 穿過洞口：球心超過筒壁就算掉出去了（之後在滑道上算）
        if (d > DRUM.r + R) { where[b] = 1; escaped = b; gateOpen = false }
        continue
      }
      px[b] *= rMax / d; py[b] *= rMax / d
      // 筒壁摩擦：切線方向的速度往筒壁的速度靠
      if (first) {
        const tx = -py[b] / rMax, ty = px[b] / rMax
        const vx = px[b] - ox[b], vy = py[b] - oy[b]
        const vt = vx * tx + vy * ty, wall = omega * DRUM.r * h
        const dv = (wall - vt) * WALL_FRICTION
        ox[b] -= tx * dv; oy[b] -= ty * dv
      }
    }
    pz[b] = Math.max(-zMax, Math.min(zMax, pz[b]))
  }
}
// 掉出來的球：滑道（斜線，左右有邊）、盤子（淺盒）、地面；座標一樣以滾筒中心為原點
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
  const floor = BASE.h + 0.1 + R
  if (toW(py[b]) < floor) py[b] = floor - DRUM.y
  if (pz[b] > CHUTE.z1) {
    px[b] = Math.max(-TRAY.w / 2 + R, Math.min(TRAY.w / 2 - R, px[b]))
    pz[b] = Math.min(TRAY.z + TRAY.d / 2 - R, pz[b])
    // 盤子底有摩擦：慢慢停下來
    if (toW(py[b]) < floor + 0.01) { ox[b] += (px[b] - ox[b]) * 0.02; oz[b] += (pz[b] - oz[b]) * 0.02 }
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
  }
  for (let it = 0; it < 4; it++) {
    collideBalls()
    drumConstraints(h, it === 0)
    for (let b = 0; b < n; b++) if (where[b]) outsideConstraints(b)
  }
  return maxV / h // 最快的球多快（場景單位／秒）
}
// 一開始：球亂放在滾筒裡，掉下來堆在底部
function initBalls() {
  for (let b = 0; b < n; b++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (DRUM.r - 1)
    px[b] = ox[b] = Math.cos(a) * r
    py[b] = oy[b] = -Math.abs(Math.sin(a) * r) * 0.6
    pz[b] = oz[b] = (rand() - 0.5) * (DRUM.d - 1)
  }
  for (let s = 0; s < 600; s++) step(1 / 240)
}

// ── 3D 場景：開獎節目的舞台 ──
// 圓形兩層的展示台（深紅＋金，邊上一圈跑馬燈）、後面鍍鉻的 A 字支架、鍍鉻的滾筒框、滾筒外面一圈燈泡、會反光的舞台地板
const PED = { r1: 15.5, r2: 14.2, h1: 0.9, floor: -1.7 } // 下層半徑、上層半徑、下層高、地板高（上層頂面＝BASE.h）
let bulbs = [] // 跑馬燈：{ mesh, n, speed }
function bulbRing(parent, n, radius, y, z, axisZ, size) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n)
  const d = new THREE.Object3D()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (axisZ) d.position.set(Math.cos(a) * radius, y + Math.sin(a) * radius, z) // 立著的圈（滾筒前面）
    else d.position.set(Math.cos(a) * radius, y, z + Math.sin(a) * radius) // 平躺的圈（展示台邊）
    d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, new THREE.Color('#fff3b0'))
  }
  parent.add(m)
  bulbs.push({ mesh: m, n })
  return m
}
// 燈泡追逐：每 4 顆亮 2 顆、往前跑；搖獎時跑快一點
const BULB_ON = new THREE.Color('#fff1a8').multiplyScalar(1.6), BULB_OFF = new THREE.Color('#5a3a10')
function animateBulbs(t, fast) {
  const k = Math.floor(t * (fast ? 22 : 7))
  for (const { mesh: m, n } of bulbs) {
    for (let i = 0; i < n; i++) m.setColorAt(i, (i + k) % 4 < 2 ? BULB_ON : BULB_OFF)
    m.instanceColor.needsUpdate = true
  }
}
// 地板：深色、會反光，邊緣慢慢透明（接到 CSS 的舞台背景）
function fadeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, '#000000')
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
function makeMachine() {
  const g = new THREE.Group()
  const acrylic = new THREE.MeshPhysicalMaterial({ color: ACRYLIC, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 })
  const chrome = new THREE.MeshStandardMaterial({ color: '#e8ecf2', roughness: 0.12, metalness: 1 })
  const gold = new THREE.MeshStandardMaterial({ color: '#e0b64a', roughness: 0.22, metalness: 1 })
  const redLac = new THREE.MeshPhysicalMaterial({ color: '#19d3c5', roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = mat !== acrylic; parent.add(m); return m }
  // 地板
  const floor = new THREE.Mesh(new THREE.CircleGeometry(46, 96), new THREE.MeshStandardMaterial({ color: '#7a1fa2', roughness: 0.15, metalness: 0.4, transparent: true, alphaMap: fadeTexture() }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = PED.floor; floor.receiveShadow = true
  g.add(floor)
  // 展示台：下層深紅（邊上一圈燈泡）、上層金色（頂面＝BASE.h）、中間一條金邊
  add(g, new THREE.CylinderGeometry(PED.r1, PED.r1 + 0.4, PED.h1, 96), redLac, 0, PED.floor + PED.h1 / 2, 0)
  bulbRing(g, 72, PED.r1 + 0.05, PED.floor + PED.h1 / 2, 0, false, 0.16)
  const h2 = BASE.h - (PED.floor + PED.h1)
  add(g, new THREE.CylinderGeometry(PED.r2, PED.r2, h2, 96), gold, 0, BASE.h - h2 / 2, 0)
  add(g, new THREE.TorusGeometry(PED.r2, 0.12, 12, 96), chrome, 0, BASE.h, 0).rotation.x = Math.PI / 2
  // 支架：滾筒後面一個鍍鉻 A 字架，兩隻腳從展示台撐到軸心
  const zb = -DRUM.d / 2 - 1.1
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * 6.5, BASE.h, zb), to = new THREE.Vector3(0, DRUM.y, zb)
    const leg = add(g, new THREE.CylinderGeometry(0.45, 0.55, from.distanceTo(to), 24), chrome, (from.x + to.x) / 2, (from.y + to.y) / 2, zb)
    leg.rotation.z = Math.atan2(-(to.x - from.x), to.y - from.y) // 圓柱本來是直的（+y），轉到腳的方向
    add(g, new THREE.CylinderGeometry(0.9, 1.1, 0.4, 24), gold, from.x, BASE.h + 0.2, zb) // 腳座
  }
  const axle = add(g, new THREE.CylinderGeometry(0.35, 0.35, DRUM.d + 2.6, 24), chrome, 0, DRUM.y, -0.6)
  axle.rotation.x = Math.PI / 2
  add(g, new THREE.SphereGeometry(1.1, 24, 16), gold, 0, DRUM.y, zb) // 軸心的金球
  // 滾筒：透明圓筒＋前後兩片透明圓板、鍍鉻的粗框；前面再一圈燈泡
  const rim = add(g, new THREE.CylinderGeometry(DRUM.r + 0.1, DRUM.r + 0.1, DRUM.d, 128, 1, true), acrylic, 0, DRUM.y, 0)
  rim.rotation.x = Math.PI / 2
  for (const sz of [-1, 1]) {
    add(g, new THREE.CircleGeometry(DRUM.r + 0.1, 128), acrylic, 0, DRUM.y, sz * DRUM.d / 2)
    add(g, new THREE.TorusGeometry(DRUM.r + 0.25, 0.32, 16, 128), chrome, 0, DRUM.y, sz * DRUM.d / 2)
  }
  bulbRing(g, 60, DRUM.r + 1.05, DRUM.y, DRUM.d / 2 + 0.1, true, 0.2)
  add(g, new THREE.TorusGeometry(DRUM.r + 1.05, 0.08, 8, 128), gold, 0, DRUM.y, DRUM.d / 2 + 0.05) // 燈泡底下的金圈
  // 跟著滾筒轉的：前面的鍍鉻輻條、金色中心蓋、裡面的擋板、出球口的框和閘門
  rot = new THREE.Group()
  rot.position.set(0, DRUM.y, 0)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const sp = add(rot, new THREE.CylinderGeometry(0.12, 0.12, DRUM.r, 12), chrome, Math.cos(a) * DRUM.r / 2, Math.sin(a) * DRUM.r / 2, DRUM.d / 2 + 0.2)
    sp.rotation.z = a - Math.PI / 2
  }
  const hub = add(rot, new THREE.CylinderGeometry(1.3, 1.3, 0.5, 48), gold, 0, 0, DRUM.d / 2 + 0.25)
  hub.rotation.x = Math.PI / 2
  add(rot, new THREE.SphereGeometry(0.7, 24, 16), chrome, 0, 0, DRUM.d / 2 + 0.55)
  for (let f = 0; f < FINS.n; f++) {
    const a = FINS.a0 + (f / FINS.n) * Math.PI * 2, mid = DRUM.r - FINS.len / 2
    const fin = add(rot, new THREE.BoxGeometry(FINS.len, FINS.t, DRUM.d), acrylic, Math.cos(a) * mid, Math.sin(a) * mid, 0)
    fin.rotation.z = a
  }
  const hole = new THREE.Group()
  hole.rotation.z = HOLE.a
  for (const sd of [-1, 1]) {
    add(hole, new THREE.BoxGeometry(0.2, HOLE.w + 0.4, 0.2), gold, DRUM.r + 0.2, 0, DRUM.d / 2 - HOLE.d / 2 + sd * HOLE.d / 2)
    add(hole, new THREE.BoxGeometry(0.2, 0.2, HOLE.d), gold, DRUM.r + 0.2, sd * (HOLE.w / 2 + 0.1), DRUM.d / 2 - HOLE.d / 2)
  }
  gate = add(hole, new THREE.BoxGeometry(0.08, HOLE.w, HOLE.d), chrome, DRUM.r + 0.25, 0, DRUM.d / 2 - HOLE.d / 2)
  rot.add(hole)
  g.add(rot)
  // 滑道：透明底、兩條鍍鉻欄杆
  const len = Math.hypot(CHUTE.z1 - CHUTE.z0 + 1, CHUTE.y0 - CHUTE.y1), slope = Math.atan2(CHUTE.y0 - CHUTE.y1, CHUTE.z1 - CHUTE.z0 + 1)
  const chute = new THREE.Group()
  chute.position.set(0, (CHUTE.y0 + CHUTE.y1) / 2 - R, (CHUTE.z0 - 1 + CHUTE.z1) / 2)
  chute.rotation.x = slope
  add(chute, new THREE.BoxGeometry(CHUTE.w, 0.08, len), acrylic, 0, 0, 0)
  for (const sd of [-1, 1]) { const r = add(chute, new THREE.CylinderGeometry(0.07, 0.07, len, 8), chrome, sd * CHUTE.w / 2, 0.5, 0); r.rotation.x = Math.PI / 2 }
  g.add(chute)
  add(g, new THREE.CylinderGeometry(0.15, 0.15, CHUTE.y0 - R - BASE.h, 12), chrome, 0, (CHUTE.y0 - R + BASE.h) / 2, CHUTE.z0 - 1)
  // 盤子：金色淺盒
  add(g, new THREE.BoxGeometry(TRAY.w, 0.1, TRAY.d), gold, 0, BASE.h + 0.05, TRAY.z)
  for (const sd of [-1, 1]) {
    add(g, new THREE.BoxGeometry(TRAY.w + 0.1, TRAY.h, 0.1), gold, 0, BASE.h + TRAY.h / 2, TRAY.z + sd * TRAY.d / 2)
    add(g, new THREE.BoxGeometry(0.1, TRAY.h, TRAY.d), gold, sd * TRAY.w / 2, BASE.h + TRAY.h / 2, TRAY.z)
  }
  return g
}

// ── 畫球：每顆球有自己的方向，照移動的距離滾動（像在下面的東西上滾：轉軸＝上方 × 移動方向、轉的角度＝距離 ÷ 半徑）──
const dummy = new THREE.Object3D()
const quat = new Float32Array(n * 4) // 每顆球的方向（四元數）
const lx = new Float32Array(n), ly = new Float32Array(n), lz = new Float32Array(n) // 上一格畫面的位置
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), axis = new THREE.Vector3()
function initSpin() {
  for (let b = 0; b < n; b++) {
    // 一開始隨便朝一個方向
    qa.setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2))
    qa.toArray(quat, b * 4)
    lx[b] = px[b]; ly[b] = py[b]; lz[b] = pz[b]
  }
}
function draw() {
  dummy.scale.setScalar(1)
  for (let b = 0; b < n; b++) {
    const dx = px[b] - lx[b], dz = pz[b] - lz[b], dy = py[b] - ly[b]
    lx[b] = px[b]; ly[b] = py[b]; lz[b] = pz[b]
    qa.fromArray(quat, b * 4)
    // 在滾筒裡貼著筒壁滾的時候，下面是筒壁；在滑道、盤子上下面是地：都用「往下」當接觸面，夠像了
    const d = Math.hypot(dx, dz) + Math.abs(dy) * 0.3
    if (d > 1e-5) {
      axis.set(dz, 0, -dx)
      if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0)
      axis.normalize()
      qb.setFromAxisAngle(axis, d / R)
      qa.premultiply(qb).normalize()
      qa.toArray(quat, b * 4)
    }
    dummy.quaternion.copy(qa)
    dummy.position.set(px[b], DRUM.y + py[b], pz[b])
    dummy.updateMatrix()
    mesh.setMatrixAt(b, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

// 盤子上的球放回滾筒：從滾筒上面掉進去
function putBack(b) {
  where[b] = 0
  px[b] = ox[b] = (rand() - 0.5) * 3; py[b] = oy[b] = DRUM.r * 0.5; pz[b] = oz[b] = (rand() - 0.5) * (DRUM.d - 2)
}
function placeInTray(b) {
  where[b] = 1
  px[b] = ox[b] = 0; py[b] = oy[b] = BASE.h + 0.1 + R - DRUM.y; pz[b] = oz[b] = TRAY.z
}

/** 抽一顆（全部照物理）：
 *  1. 滾筒加速、轉 SPIN.sec 秒（每次乘 0.85～1.15 的亂數）、減速
 *  2. 慢慢轉到出球口朝正下方，打開閘門
 *  3. 哪一顆球靠重力先穿過洞口就是抽到的，閘門馬上關；那顆球掉到滑道、滾進盤子，停下來才 resolve（回傳第幾顆球） */
let phase = 'idle', busy = null, t0 = 0, spinSec = 0, inTray = -1, resolveFn = null
function play() {
  if (busy) return busy
  busy = new Promise((resolve) => {
    resolveFn = resolve
    if (inTray >= 0) { putBack(inTray); inTray = -1 }
    escaped = -1
    spinSec = SPIN.sec * (0.85 + Math.random() * 0.3)
    phase = 'spin'; t0 = performance.now(); moving = true
  })
  return busy
}
defineExpose({ play })

// 每一格畫面：照階段決定滾筒轉速、閘門，再算物理
function update(dt) {
  const t = (performance.now() - t0) / 1000
  if (phase === 'spin') {
    const up = Math.min(1, t / SPIN.ramp), down = Math.min(1, Math.max(0, (spinSec - t) / SPIN.ramp))
    omega = SPIN.w * Math.min(up, down)
    if (t >= spinSec) { phase = 'align' }
  } else if (phase === 'align') {
    // 轉到出球口朝下（−90°）：往近的那邊轉，越接近越慢
    const diff = wrapA(-Math.PI / 2 - (HOLE.a + angle))
    omega = Math.sign(diff) * Math.min(SPIN.alignW, Math.abs(diff) * 4 + 0.1)
    if (Math.abs(diff) < 0.01) { omega = 0; phase = 'open'; gateOpen = true; t0 = performance.now() }
  } else if (phase === 'open') {
    omega = 0
    if (escaped >= 0) { phase = 'roll'; t0 = performance.now() }
    // 洞口上面剛好沒有球（很少見）：滾筒前後輕輕搖一下
    else if (t > 1.5) omega = Math.sin(t * 8) * 0.6
  } else if (phase === 'roll') {
    omega = 0
    const b = escaped
    const v = Math.hypot(px[b] - ox[b], py[b] - oy[b], pz[b] - oz[b]) / (dt / SUB)
    if ((pz[b] > CHUTE.z1 && v < 0.3) || t > 6) {
      phase = 'idle'; inTray = b; busy = null
      resolveFn?.(b); resolveFn = null
    }
  }
  angle += omega * dt
  rot.rotation.z = angle
  gate.visible = !gateOpen
  if (moving || phase !== 'idle') {
    let v = 0
    for (let k = 0; k < SUB; k++) v = Math.max(v, step(dt / SUB))
    moving = v > 0.1
  }
}

// ── 球的說明：滑鼠滑過去；手機點一下（拖曳轉鏡頭不算）、3 秒後收起來 ──
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
let down = null, tipTimer = 0
function pickAt(e) {
  const r = glBox.value.getBoundingClientRect()
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObject(mesh)[0]
  tip.value = hit ? { x: e.clientX - r.left, y: e.clientY - r.top, html: props.tipOf(hit.instanceId) } : null
}
function onMove(e) {
  if (e.pointerType === 'mouse' && !e.buttons) pickAt(e)
  else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) tip.value = null
}
function onDown(e) { down = { x: e.clientX, y: e.clientY } }
function onUp(e) {
  if (e.pointerType !== 'mouse' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6) {
    pickAt(e)
    clearTimeout(tipTimer)
    tipTimer = setTimeout(() => (tip.value = null), 3000)
  }
  down = null
}
function onLeave(e) { if (e.pointerType === 'mouse') tip.value = null }

// 舞台＝整個元件（4:5）；搖獎機往上移一點，下面留給結果看板
function resize() {
  const W = wrap.value.clientWidth, H = wrap.value.clientHeight
  if (!W || !H) return
  Object.assign(box, { x: 0, y: 0, w: W, h: H })
  renderer.setSize(box.w, box.h)
  camera.aspect = box.w / box.h
  camera.setViewOffset(box.w, box.h, 0, box.h * VIEW_UP, box.w, box.h)
  camera.updateProjectionMatrix()
  controls?.handleResize()
}
// 彩帶：每次公布結果灑一次（位置、顏色、速度隨機）
const CONFETTI = ['#ffd75e', '#ff4d6d', '#4dd2ff', '#7cff6b', '#ffffff', '#c77dff']
const pieces = ref([])
watch(() => props.party, (v) => {
  pieces.value = !v ? [] : Array.from({ length: 70 }, () => ({
    left: `${Math.random() * 100}%`, background: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${2.2 + Math.random() * 1.6}s`,
    '--rot': `${Math.random() * 720 - 360}deg`, '--dx': `${Math.random() * 160 - 80}px`,
    width: `${10 + Math.random() * 10}px`, height: `${6 + Math.random() * 8}px`,
  }))
})
let last = performance.now()
function frame() {
  raf = requestAnimationFrame(frame)
  const now = performance.now(), dt = Math.min(1 / 30, (now - last) / 1000)
  last = now
  update(dt)
  animateBulbs(now / 1000, phase !== 'idle')
  draw()
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0) // 透明：後面是 CSS 畫的舞台
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  glBox.value.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  // 燈光：前上方一盞暖白主燈（打影子）、左右兩盞彩色側光（洋紅、青），像攝影棚
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const key = new THREE.SpotLight('#fff4e0', 2600, 0, Math.PI / 7, 0.5, 1.6)
  key.position.set(8, 60, 46); key.target.position.set(0, DRUM.y * 0.6, 0)
  key.castShadow = true; key.shadow.bias = -0.0004
  key.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches ? 1024 : 2048) // 手機影子貼圖小一點，比較順
  const left = new THREE.SpotLight('#ff4fa3', 1500, 0, Math.PI / 6, 0.6, 1.6); left.position.set(-40, 26, 18); left.target.position.set(0, DRUM.y, 0)
  const right = new THREE.SpotLight('#5ff2ff', 1500, 0, Math.PI / 6, 0.6, 1.6); right.position.set(40, 26, 18); right.target.position.set(0, DRUM.y, 0)
  scene.add(key, key.target, left, left.target, right, right.target)
  scene.add(makeMachine())
  mesh = makeBallMesh({ balls: props.balls, colors: props.colors, atlas: props.atlas, grid: props.grid, face: props.face })
  mesh.castShadow = true
  scene.add(mesh)
  initBalls()
  if (props.sel != null) placeInTray(props.sel)
  inTray = props.sel ?? -1
  initSpin()
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500)
  // 預設視角：從右前方斜上看（方位 28°、仰角 22°），看得到滾筒的前面、側面和後面的 A 字架
  const az = THREE.MathUtils.degToRad(CAM.az), el = THREE.MathUtils.degToRad(CAM.el)
  camera.position.set(Math.sin(az) * Math.cos(el) * CAM.dist, DRUM.y * 0.85 + Math.sin(el) * CAM.dist, Math.cos(az) * Math.cos(el) * CAM.dist)
  // 3D 可以往任何方向一直轉（不限仰角）：左鍵轉、滾輪縮放、右鍵平移
  controls = new TrackballControls(camera, renderer.domElement)
  controls.target.set(0, DRUM.y * 0.85, 0)
  controls.rotateSpeed = 3; controls.zoomSpeed = 1.2; controls.panSpeed = 0.8
  controls.dynamicDampingFactor = 0.15
  ro = new ResizeObserver(resize)
  ro.observe(wrap.value)
  resize()
  frame()
})
watch(() => props.face, () => mesh && setBallFace(mesh, props.face))
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(tipTimer)
  ro?.disconnect()
  controls?.dispose()
  scene?.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.() })
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<style scoped>
.lottery-drum { position: relative; width: 100%; aspect-ratio: 4 / 5; overflow: hidden; background: #161616; }
.stage { position: absolute; overflow: hidden; }
/* 舞台背景：深紫到深紅的漸層、兩道會晃的聚光燈、地上一圈光 */
/* 80 年代美國綜藝節目的舞台：洋紅到橘到黃的夕陽漸層、彩色放射狀色塊（慢慢轉）、地平線的格子地板、兩道白色聚光燈 */
.stage-bg { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(180deg, #2b0a5e 0%, #7a1fa2 30%, #ff2e88 58%, #ff8a00 78%, #ffd23f 100%); }
.stage-bg > .rays { position: absolute; left: 50%; top: 42%; width: 240%; aspect-ratio: 1; transform: translate(-50%, -50%); opacity: 0.55;
  background: repeating-conic-gradient(from 0deg, #ff2e88 0deg 10deg, #ff8a00 10deg 20deg, #ffd23f 20deg 30deg, #19d3c5 30deg 40deg, #7a1fa2 40deg 50deg);
  animation: rays 60s linear infinite; -webkit-mask: radial-gradient(circle, #000 8%, transparent 55%); mask: radial-gradient(circle, #000 8%, transparent 55%); }
@keyframes rays { to { transform: translate(-50%, -50%) rotate(360deg); } }
/* 地平線以下：霓虹格子地板（往遠處縮） */
.stage-bg::before { content: ''; position: absolute; left: -50%; right: -50%; bottom: -10%; height: 42%; transform: perspective(500px) rotateX(62deg); transform-origin: 50% 100%;
  background-image: linear-gradient(#ffffffaa 2px, transparent 2px), linear-gradient(90deg, #ffffffaa 2px, transparent 2px); background-size: 60px 60px;
  -webkit-mask: linear-gradient(0deg, #000 30%, transparent 100%); mask: linear-gradient(0deg, #000 30%, transparent 100%); }
/* 星星點點 */
.stage-bg::after { content: ''; position: absolute; inset: 0 0 55% 0; opacity: 0.6;
  background-image: radial-gradient(circle, #ffffff 0 1.2px, transparent 2px); background-size: 34px 34px; }
.beam { position: absolute; top: -10%; width: 60%; height: 120%; opacity: 0.35; mix-blend-mode: screen;
  background: conic-gradient(from 180deg at 50% 0%, transparent 168deg, rgba(255, 255, 255, 0.95) 180deg, transparent 192deg); filter: blur(6px); }
.beam.l { left: -10%; transform-origin: 50% 0; animation: sway 5s ease-in-out infinite alternate; }
.beam.r { right: -10%; transform-origin: 50% 0; animation: sway 5s ease-in-out infinite alternate-reverse; }
@keyframes sway { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
.floor { position: absolute; left: 10%; right: 10%; bottom: 22%; height: 16%; border-radius: 50%;
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.55), transparent 70%); }
.stage-gl { position: absolute; inset: 0; touch-action: none; }
.stage-gl :deep(canvas) { display: block; }
/* 1080×1350 的設計稿，縮放到 IG 框 */
.stage-ui { position: absolute; left: 0; top: 0; width: 1080px; height: 1350px; transform-origin: 0 0; pointer-events: none;
  font-family: 'Overpass', 'Noto Sans TC', sans-serif; }
/* 節目標題：金字、燈泡框 */
/* 節目標題：80 年代的鉻字（上面天藍、下面夕陽橘、中間一條地平線）、斜體、粗黑邊；後面三條彩虹色帶；燈泡框 */
.show-title { position: absolute; left: 50%; top: 30px; transform: translateX(-50%); width: 760px; padding: 16px 0 18px; text-align: center; }
.show-title::before { content: ''; position: absolute; left: -60px; right: -60px; top: 50%; height: 96px; transform: translateY(-38%) skewY(-4deg);
  background: linear-gradient(180deg, #ff2e88 0 33%, #ff8a00 33% 66%, #ffd23f 66%); box-shadow: 0 6px 0 #2b0a5e; }
.st-bulbs { display: none; }
@keyframes blink { 50% { opacity: 0.3; } }
.st-en { position: relative; display: inline-block; padding: 4px 18px; border-radius: 999px; background: #19d3c5; color: #2b0a5e; transform: skewX(-12deg);
  font-size: 22px; font-weight: 900; letter-spacing: 0.3em; box-shadow: 0 4px 0 #2b0a5e; }
.st-zh { position: relative; margin: 6px 0 2px; font-size: 92px; font-weight: 900; line-height: 0.95; letter-spacing: -0.01em; transform: skewX(-10deg);
  background: linear-gradient(180deg, #e9fbff 0%, #9fdcff 40%, #ffffff 49%, #3a1a6e 51%, #ff8a00 70%, #ffe66d 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  -webkit-text-stroke: 3px #2b0a5e; filter: drop-shadow(6px 6px 0 #2b0a5e); }
.st-sub { position: relative; display: inline-block; margin-top: 8px; padding: 4px 16px; background: #2b0a5e; color: #ffd23f; transform: skewX(-12deg);
  font-size: 18px; font-weight: 900; letter-spacing: 0.08em; }
/* 結果看板（index.vue 的 slot）：貼著下面，放在搖獎機底座下面、不擋到機器 */
.show-board { position: absolute; left: 50%; bottom: 232px; transform: translateX(-50%) scale(1.05); transform-origin: 50% 100%; pointer-events: auto; }
/* 彩帶 */
.confetti { position: absolute; inset: 0; overflow: hidden; }
.confetti i { position: absolute; top: -30px; border-radius: 2px; animation-name: fall; animation-timing-function: cubic-bezier(0.3, 0.5, 0.6, 1); animation-fill-mode: forwards; }
@keyframes fall { to { transform: translate(var(--dx), 1420px) rotate(var(--rot)); } }
/* 舞台上的大按鈕：街機那種紅色圓頂按鈕、金框，按下去會陷下去 */
.show-btn { position: absolute; z-index: 3; left: 46px; right: 46px; bottom: 104px; height: 112px; padding: 10px; border: 0; border-radius: 999px; cursor: pointer; pointer-events: auto;
  background: linear-gradient(145deg, #fff3c4, #c99a2e 55%, #7a5a12); box-shadow: 0 12px 0 #4a3608, 0 18px 30px rgba(0, 0, 0, 0.5); transition: transform 0.08s, box-shadow 0.08s; }
.show-btn .sb-dome { display: flex; flex-direction: row; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 999px;
  background: radial-gradient(ellipse 60% 120% at 40% 10%, #ff8a8a 0%, #e0142a 45%, #8a0612 100%); color: #ffffff;
  box-shadow: inset 0 -10px 18px rgba(0, 0, 0, 0.35), inset 0 6px 10px rgba(255, 255, 255, 0.35); }
.show-btn b { font-size: 52px; font-weight: 900; letter-spacing: 0.04em; text-shadow: 0 3px 0 rgba(0, 0, 0, 0.3); }
.show-btn small { margin-top: 2px; font-size: 18px; font-weight: 800; letter-spacing: 0.3em; color: #ffe08a; }
.show-btn:hover:not(:disabled) .sb-dome { filter: brightness(1.12); }
.show-btn:active:not(:disabled), .show-btn.busy { transform: translateY(10px); box-shadow: 0 2px 0 #4a3608, 0 6px 14px rgba(0, 0, 0, 0.5); }
.show-btn.busy { cursor: default; }
.show-btn.busy .sb-dome { animation: btn-glow 0.5s ease-in-out infinite alternate; }
@keyframes btn-glow { to { filter: brightness(1.35); } }
/* 觀眾人影：深紫黑色剪影，後排淡一點；手臂繞肩膀轉，一開一合就是拍手；整個人跟著上下跳 */
.crowd { position: absolute; left: 0; bottom: 0; width: 1080px; height: 260px; pointer-events: none; z-index: 1; }
.crowd .row { fill: #12052a; stroke: #12052a; }
.crowd .r0 { opacity: 0.7; transform: translateY(-34px); }
.crowd .arm { fill: none; stroke-linecap: round; animation: clap-l 0.32s ease-in-out infinite alternate; }
.crowd .arm.r { animation-name: clap-r; }
.crowd .fan { animation: fan-bob 0.64s ease-in-out infinite alternate; }
@keyframes clap-l { from { transform: rotate(-22deg); } to { transform: rotate(4deg); } }
@keyframes clap-r { from { transform: rotate(22deg); } to { transform: rotate(-4deg); } }
@keyframes fan-bob { from { transform: translateY(0); } to { transform: translateY(-8px); } }
/* 跑馬燈：四邊各一排燈泡（暗的一排＋亮的一排），亮的那排的背景位置一直往前移，看起來就是燈在繞圈跑（上→右→下→左，順時針） */
.marquee { position: absolute; inset: 10px; pointer-events: none; z-index: 2; --gap: 30px; --dur: 1.1s; }
.marquee.fast { --dur: 0.35s; }
.marquee i { position: absolute; filter: drop-shadow(0 0 6px #ffd75e); }
.marquee .mt, .marquee .mb { left: 0; right: 0; height: 20px; background-repeat: repeat-x; }
.marquee .ml, .marquee .mr { top: 0; bottom: 0; width: 20px; background-repeat: repeat-y; }
.marquee .mt { top: 0; } .marquee .mb { bottom: 0; } .marquee .ml { left: 0; } .marquee .mr { right: 0; }
.marquee .mt, .marquee .mb { background-image: radial-gradient(circle, #fffbe6 0 5px, #ffcf3a 6.5px, transparent 8px), radial-gradient(circle, #7a4a10 0 4px, transparent 5px);
  background-size: calc(var(--gap) * 3) 20px, var(--gap) 20px; }
.marquee .ml, .marquee .mr { background-image: radial-gradient(circle, #fffbe6 0 5px, #ffcf3a 6.5px, transparent 8px), radial-gradient(circle, #7a4a10 0 4px, transparent 5px);
  background-size: 20px calc(var(--gap) * 3), 20px var(--gap); }
.marquee .mt { animation: mq-r var(--dur) steps(3) infinite; }
.marquee .mb { animation: mq-l var(--dur) steps(3) infinite; }
.marquee .mr { animation: mq-d var(--dur) steps(3) infinite; }
.marquee .ml { animation: mq-u var(--dur) steps(3) infinite; }
@keyframes mq-r { from { background-position: 0 0, 0 0; } to { background-position: calc(var(--gap) * 3) 0, 0 0; } }
@keyframes mq-l { from { background-position: 0 0, 0 0; } to { background-position: calc(var(--gap) * -3) 0, 0 0; } }
@keyframes mq-d { from { background-position: 0 0, 0 0; } to { background-position: 0 calc(var(--gap) * 3), 0 0; } }
@keyframes mq-u { from { background-position: 0 0, 0 0; } to { background-position: 0 calc(var(--gap) * -3), 0 0; } }
.drum-tip { position: absolute; pointer-events: none; z-index: 5; max-width: min(240px, 70%); padding: 8px 10px; border-radius: 4px; background: #ffffff; color: #161616; font-size: 12px; line-height: 1.5; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3); }
</style>
