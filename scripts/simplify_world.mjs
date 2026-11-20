// 把地圖的國界簡化：點不用那麼密，只留轉折的特徵點，線看起來比較乾淨。
// 用法：node scripts/simplify_world.mjs [容許誤差（度，預設 0.25）] [圓點直徑（px，預設 8）：比圓點小的島不畫]
// 讀 src/data/countries-50m.geojson（原始檔不動）
// → 寫 src/data/countries-simple.geojson（國家的面）、src/data/bevel-simple.geojson（每一國的亮邊、暗邊，地圖用來做立體感）、
//   src/data/borders-simple.geojson（兩國之間的國界線，不含海岸線；地圖現在沒在用）
// 做法：先把所有國家的邊界切成「弧」（兩國共用的那一段是同一條弧），每條弧只簡化一次（Douglas–Peucker：留離直線最遠的點），
// 所以相鄰兩國的邊界簡化後還是同一條線，不會裂開或重疊。
// 小島（整圈不跟別國相連）在手機地圖一開始的大小下，如果比微型國家的圓點還小（整個島塞得進圓點裡），就不畫；被別國包住的國家（賴索托、聖馬利諾）不是島，照畫。
// 每一國的 properties.km2＝原本全部陸地的面積（地圖用它決定哪些微型國家、島國要改畫圓點）
import { readFileSync, writeFileSync } from 'node:fs'
const TOL = Number(process.argv[2] ?? 0.25), DOT = Number(process.argv[3] ?? 8)
const WORLD_PX = 1441 // 手機上地圖一開始的大小：整個世界（經度 360°）寬幾 px（畫面高約 640 px 時）
const src = new URL('../src/data/countries-50m.geojson', import.meta.url), out = new URL('../src/data/countries-simple.geojson', import.meta.url)
const world = JSON.parse(readFileSync(src))
const key = (p) => `${p[0]},${p[1]}`
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
// 併進另一國的地區：兩塊中間那一段邊界拿掉，變成一塊（西撒哈拉 → 摩洛哥）
const MERGE = { SAH: 'MAR' }
function union(A, B) { // 兩圈外框（有共用的邊）→ 合起來的外框
  const edges = (r) => r.slice(0, -1).map((p, i) => [p, r[i + 1]])
  const ek = ([a, b]) => `${key(a)}>${key(b)}`, rk = ([a, b]) => `${key(b)}>${key(a)}`
  const ea = edges(A), dir = new Set(ea.map(ek))
  let eb = edges(B)
  // 兩圈繞的方向要一樣，共用的邊才會一正一反：同方向的比反方向的多，就把 B 倒過來
  if (eb.filter((e) => dir.has(ek(e))).length > eb.filter((e) => dir.has(rk(e))).length) eb = edges(B.slice().reverse())
  if (!eb.some((e) => dir.has(rk(e)))) return null // 沒有共用的邊
  const all = [...ea, ...eb], has = new Set(all.map(ek)), seen = new Set()
  const next = new Map() // 起點 → 從這裡出去的邊（共用的邊、來回走的毛邊都拿掉；兩圈重複的同一條邊只留一條）
  for (const e of all) {
    if (has.has(rk(e)) || seen.has(ek(e))) continue
    seen.add(ek(e))
    const k = key(e[0])
    if (!next.has(k)) next.set(k, [])
    next.get(k).push(e[1])
  }
  const loops = []
  while (next.size) {
    const [k0] = next.keys(), loop = []
    let k = k0
    while (next.has(k)) { const outs = next.get(k), p = outs.pop(); if (!outs.length) next.delete(k); loop.push(p); k = key(p) }
    loops.push([loop.at(-1), ...loop])
  }
  return loops.sort((a, b) => b.length - a.length)[0] // 最長的那一圈是外框（其他是接縫的小碎片）
}
for (const [from, to] of Object.entries(MERGE)) {
  const a = world.features.find((f) => f.properties.adm0_a3 === to), b = world.features.find((f) => f.properties.adm0_a3 === from)
  const pa = polys(a.geometry)
  for (const pb of polys(b.geometry)) {
    const i = pa.findIndex((p) => union(p[0], pb[0]))
    if (i >= 0) pa[i] = [union(pa[i][0], pb[0]), ...pa[i].slice(1), ...pb.slice(1)]
    else pa.push(pb)
  }
  a.geometry = { type: 'MultiPolygon', coordinates: pa }
  world.features = world.features.filter((f) => f !== b)
  console.log(`${from} 併進 ${to}`)
}
// 不在人口表裡的地區（格陵蘭、南極洲、科索沃、各國的海外屬地…）照畫，地圖用「沒資料」的灰色

// 每個點的鄰居：鄰居不是剛好 2 個的點＝接點（三國交界、共用邊界的頭尾）
const nb = new Map()
const link = (a, b) => { const k = key(a); let s = nb.get(k); if (!s) nb.set(k, (s = new Set())); s.add(key(b)) }
const open = (r) => (key(r[0]) === key(r.at(-1)) ? r.slice(0, -1) : r.slice())
for (const f of world.features) for (const p of polys(f.geometry)) for (const ring of p) {
  const r = open(ring)
  r.forEach((pt, i) => { link(pt, r[(i + 1) % r.length]); link(pt, r[(i - 1 + r.length) % r.length]) })
}
// 一圈的面積（平方公里）
const km2 = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += ((r[i + 1][0] - r[i][0]) * Math.PI / 180) * (2 + Math.sin(r[i][1] * Math.PI / 180) + Math.sin(r[i + 1][1] * Math.PI / 180)); return Math.abs(a * 6371 * 6371 / 2) }
// 每個點被幾圈用到：島的點只有自己那一圈在用
const used = new Map()
for (const f of world.features) for (const p of polys(f.geometry)) for (const ring of p) for (const pt of open(ring)) used.set(key(pt), (used.get(key(pt)) ?? 0) + 1)
// 這一圈在地圖一開始的大小下有多大（px，寬和高取大的；麥卡托投影）
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
function sizePx(r) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  return Math.max(((x1 - x0) * WORLD_PX) / 360, ((mercY(y1) - mercY(y0)) * WORLD_PX) / (2 * Math.PI))
}
const isIsland = (ring) => open(ring).every((pt) => used.get(key(pt)) === 1)
const isNode = (pt) => nb.get(key(pt)).size !== 2

// Douglas–Peucker（緯度越高經度越擠：橫的距離乘 cos 緯度）
function dp(pts, tol) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const k = Math.cos((((pts[a][1] + pts[b][1]) / 2) * Math.PI) / 180), ax = pts[a][0] * k, ay = pts[a][1], dx = pts[b][0] * k - ax, dy = pts[b][1] - ay, len = dx * dx + dy * dy
    let far = -1, max = tol * tol
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] * k - ax, py = pts[i][1] - ay, t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0
      const d = (px - t * dx) ** 2 + (py - t * dy) ** 2
      if (d > max) { max = d; far = i }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]) }
  }
  return pts.filter((_, i) => keep[i])
}
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1]
const cache = new Map()
const uses = new Map() // 每條弧被幾圈用到：2 圈＝兩國之間的國界；1 圈＝海岸線
const use = (k) => uses.set(k, (uses.get(k) ?? 0) + 1)
// 一條弧（頭尾是接點）：不管哪一國、哪個方向走過來，都用同一個方向簡化，結果才會一模一樣
function arc(pts) {
  const rev = cmp(pts[0], pts.at(-1)) > 0 || (cmp(pts[0], pts.at(-1)) === 0 && cmp(pts[1], pts.at(-2)) > 0)
  const canon = rev ? pts.slice().reverse() : pts
  const k = `${key(canon[0])}|${key(canon[1])}|${key(canon.at(-1))}|${canon.length}`
  if (!cache.has(k)) cache.set(k, dp(canon, TOL))
  use(k)
  const s = cache.get(k)
  return rev ? s.slice().reverse() : s
}
// 整圈沒有接點（島、被包住的國家）：從最左下的點開始、固定方向；點太少就把誤差減半再試，最少 4 個點
function loop(r) {
  let i0 = 0
  r.forEach((p, i) => { if (cmp(p, r[i0]) < 0) i0 = i })
  let c = [...r.slice(i0), ...r.slice(0, i0)]
  const rev = cmp(c[1], c.at(-1)) > 0
  if (rev) c = [c[0], ...c.slice(1).reverse()]
  const k = `L${key(c[0])}|${key(c[1])}|${c.length}`
  if (!cache.has(k)) {
    let s, tol = TOL
    const far = c.reduce((m, p, i) => ((p[0] - c[0][0]) ** 2 + (p[1] - c[0][1]) ** 2 > (c[m][0] - c[0][0]) ** 2 + (c[m][1] - c[0][1]) ** 2 ? i : m), 0)
    do { s = [...dp(c.slice(0, far + 1), tol), ...dp([...c.slice(far), c[0]], tol).slice(1, -1)]; tol /= 2 } while (s.length < Math.min(4, c.length) && tol > 1e-6)
    cache.set(k, s)
  }
  use(k)
  const s = cache.get(k)
  return rev ? [s[0], ...s.slice(1).reverse()] : s
}
function ring(orig) {
  const r = open(orig), n = r.length, first = r.findIndex(isNode)
  let o
  if (first < 0) o = loop(r)
  else {
    o = []
    let a = first
    do {
      const pts = [r[a]]
      let b = a
      do { b = (b + 1) % n; pts.push(r[b]) } while (!isNode(r[b]))
      o.push(...arc(pts).slice(0, -1))
      a = b
    } while (a !== first)
  }
  return o.length >= 3 ? [...o, o[0]] : orig
}
let before = 0, after = 0, dropped = 0
for (const f of world.features) {
  const all = polys(f.geometry)
  f.properties.km2 = Math.round(all.reduce((sum, p) => sum + km2(p[0]), 0))
  let kept = all.filter((p) => !(isIsland(p[0]) && sizePx(p[0]) < DOT))
  dropped += all.length - kept.length
  for (const p of all) for (const r of p) before += r.length
  const ps = kept.map((p) => p.map((r) => { const s = ring(r); after += s.length; return s }))
  f.geometry = { type: 'MultiPolygon', coordinates: ps } // 全部都是小島的國家：沒有陸地可畫（地圖畫圓點）
}
writeFileSync(out, JSON.stringify(world))
// 立體感用的邊（浮雕）：每一國的外框切成「朝左上的邊」（亮邊）和「朝右下的邊」（暗邊），地圖各畫一條往國家裡面縮的線。
// 每一段都排成「國家在線的右手邊」，地圖用 line-offset 正值就是往國家裡面
const bevel = { light: [], dark: [] }
const area2 = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a }
for (const f of world.features) for (const p of f.geometry.coordinates) p.forEach((r0, hole) => {
  // 外圈要順時針（國家在右手邊），洞要逆時針
  const r = (area2(r0) > 0) === (hole === 0) ? r0.slice().reverse() : r0
  let run = null, kind = ''
  const flush = () => { if (run && run.length > 1) bevel[kind].push(run); run = null }
  for (let i = 0; i < r.length - 1; i++) {
    const k = Math.cos((r[i][1] * Math.PI) / 180), dx = (r[i + 1][0] - r[i][0]) * k, dy = r[i + 1][1] - r[i][1], len = Math.hypot(dx, dy) || 1
    const nw = (dy + dx) / len / Math.SQRT2 // 朝外的方向（線的左手邊）跟「左上」有多一致：1＝正對左上、-1＝正對右下
    const kd = nw > 0.2 ? 'light' : nw < -0.2 ? 'dark' : ''
    if (kd !== kind) { flush(); kind = kd }
    if (kd) (run ??= [r[i]]).push(r[i + 1])
  }
  flush()
})
writeFileSync(new URL('../src/data/bevel-simple.geojson', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features: Object.entries(bevel).map(([k, c]) => ({ type: 'Feature', properties: { k }, geometry: { type: 'MultiLineString', coordinates: c } })) }))
// 國界線（只有兩國之間的那幾段，靠海的不算）：地圖只畫這些線，海岸線不描邊
const borders = [...uses].filter(([, n]) => n > 1).map(([k]) => (k[0] === 'L' ? [...cache.get(k), cache.get(k)[0]] : cache.get(k)))
writeFileSync(new URL('../src/data/borders-simple.geojson', import.meta.url), JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: borders } }] }))
console.log(`國界 ${borders.length} 段`)
console.log(`誤差 ${TOL}°、比 ${DOT}px 圓點小的島不畫：${before} 點 → ${after} 點（${((after / before) * 100).toFixed(1)}%），少畫 ${dropped} 個島`)

// ── 小世界地圖（中獎看板、結果票卡的 WorldLocator）：跟大地圖用同一份形狀，轉成 SVG 路徑 ──
// 等距圓柱：x＝經度＋180、y＝84－緯度（一位小數）；d＝路徑、b＝外框、c＝標籤點。沒有形狀的小島國只有標籤點（畫光環的位置）
{
  const r1 = (v) => Math.round(v * 10) / 10
  const svg = {}
  for (const f of JSON.parse(readFileSync(out, 'utf8')).features) {
    const p = f.properties, g = f.geometry
    const polys = !g?.coordinates?.length ? [] : g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    let d = '', x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const poly of polys) for (const ring of poly) {
      let last = ''
      ring.forEach(([lon, lat], i) => {
        const x = r1(lon + 180), y = r1(84 - lat), s = `${x} ${y}`
        if (s === last) return
        last = s; d += `${i ? 'L' : 'M'}${s}`
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
      })
      d += 'Z'
    }
    const c = [r1(p.label_x + 180), r1(84 - p.label_y)]
    svg[p.adm0_a3] = { d, b: d ? [x0, y0, x1, y1] : [c[0], c[1], c[0], c[1]], c }
  }
  writeFileSync(new URL('../src/data/world-svg.json', import.meta.url), JSON.stringify(svg))
  console.log(`小世界地圖 ${Object.keys(svg).length} 個`)
}
