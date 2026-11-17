// 每國幾顆球：1 顆球＝1,000 萬人，四捨五入，不到 1 顆的也給 1 顆 → src/data/balls.json
// 世界彩球盒（src/data/cells.json）跟著改：格子還是原來那 27×33 格，球變少的國家從自己那一塊的邊角拿掉幾格（空著），
// 拿的時候那一國剩下的格子還是要連成一塊。球變多的國家沒辦法自動排（要回 Day 25 的 build_cells.py 重排）。
// 人口資料（lottery.json）更新之後重跑：node scripts/build_balls.mjs && node scripts/build_settled.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const UNIT = 1e7
const path = (f) => new URL(`../src/data/${f}`, import.meta.url)
const read = (f) => JSON.parse(readFileSync(path(f)))
const C = read('lottery.json').countries, old = read('balls.json'), cells = read('cells.json')
const isos = Object.keys(C) // 人口由多到少
const counts = Object.fromEntries(isos.map((iso) => [iso, Math.max(1, Math.round(C[iso].pop / UNIT))]))

const { cols, rows } = cells
const out = []
let b0 = 0, dropped = 0
for (const iso of old.isos) {
  let mine = cells.cell.slice(b0, b0 + old.counts[iso])
  b0 += old.counts[iso]
  if (counts[iso] > mine.length) throw new Error(`${iso} 球變多了（${mine.length} → ${counts[iso]}），格子要重排`)
  const nb = (k) => [k % cols ? k - 1 : -1, k % cols < cols - 1 ? k + 1 : -1, k >= cols ? k - cols : -1, k < cols * (rows - 1) ? k + cols : -1].filter((x) => x >= 0)
  const connected = (set) => {
    const seen = new Set([set[0]]), todo = [set[0]], has = new Set(set)
    while (todo.length) for (const x of nb(todo.pop())) if (has.has(x) && !seen.has(x)) { seen.add(x); todo.push(x) }
    return seen.size === set.length
  }
  while (mine.length > counts[iso]) {
    // 拿掉「旁邊同一國的格子最少」的那一格（邊角）；一樣多就拿離這一國中心最遠的
    const has = new Set(mine)
    const cx = mine.reduce((s, k) => s + (k % cols), 0) / mine.length, cy = mine.reduce((s, k) => s + Math.floor(k / cols), 0) / mine.length
    const score = (k) => nb(k).filter((x) => has.has(x)).length * 1000 - Math.hypot((k % cols) - cx, Math.floor(k / cols) - cy)
    const pickK = mine.slice().sort((a, b) => score(a) - score(b)).find((k) => connected(mine.filter((x) => x !== k)))
    mine = mine.filter((x) => x !== pickK)
    dropped++
  }
  out.push(...mine)
}
const total = out.length
writeFileSync(path('balls.json'), JSON.stringify({ unit: UNIT, total, isos, counts }))
writeFileSync(path('cells.json'), JSON.stringify({ cols, rows, cell: out }))
console.log(`balls.json：${total} 顆球（1 顆＝${UNIT.toLocaleString()} 人，${Object.values(counts).filter((n) => n === 1).length} 國只有 1 顆）；cells.json 空了 ${dropped} 格`)
