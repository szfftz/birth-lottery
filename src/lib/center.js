// 國家的中心：取面積最大的那一塊（本土），算它的面積重心；
// 形狀凹進去、重心落在外面（越南、智利那種）就退回原本的標籤點
function inside([x, y], ring) {
  let a = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) a = !a
  }
  return a
}
export function mainCenter(rings, fallback) {
  let best = null
  for (const r of rings) {
    if (r.length < 3) continue
    let A = 0, cx = 0, cy = 0
    for (let i = 0; i < r.length; i++) {
      const [a, b] = r[i], [c, d] = r[(i + 1) % r.length], k = a * d - c * b
      A += k; cx += (a + c) * k; cy += (b + d) * k
    }
    if (A && (!best || Math.abs(A) > Math.abs(best.A))) best = { A, p: [cx / (3 * A), cy / (3 * A)], r }
  }
  return best && inside(best.p, best.r) ? best.p : fallback
}
// SVG 路徑（只有 M、L、Z）→ 每一塊的點
export const svgRings = (d) => d.split('Z').map((sp) => [...sp.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]))
// GeoJSON 幾何 → 每一塊的外圈
export const geoRings = (g) => (g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : [])
