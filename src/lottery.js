// 投胎樂透的資料與計算（從 K30DayMapChallenge Day 25 搬過來，只留遊戲模式要用的）
// 機率＝球數比例（遊戲是真的從 891 顆球裡掉一顆出來）；獎項依 HDI 切 8 級（build_tiers.py 挑切點，機率盡量接近 1:2:4:…:128）
import { L } from './i18n.js'
import { ref, shallowRef } from 'vue'
import data from './data/lottery.json'
import cellMeta from './data/cells.json'
import ballMeta from './data/balls.json'
import tierMeta from './data/tiers.json'
import flagMeta from './data/flags.json'
import flagsUrl from './data/flags.png?url'

export const { meta, countries: C } = data
export const ISOS = Object.keys(C) // 人口由多到少
export { flagMeta, flagsUrl }

// 彩球：總共 891 顆，每國至少 1 顆，其他照人口分（1 顆＝平均人數）
export const POP_UNIT = ballMeta.unit
export const BALLS = ballMeta.counts
export const BALL_TOTAL = ballMeta.total
export const ONE_BALL = Object.values(BALLS).filter((n) => n === 1).length
// 第 k 國的球是第 start[k]～start[k+1]-1 顆（照 balls.json 的國家順序，跟國旗拼圖同一個順序）
export const balls = (() => {
  const isos = ballMeta.isos, start = new Int32Array(isos.length + 1)
  isos.forEach((iso, k) => (start[k + 1] = start[k] + BALLS[iso]))
  return { isos, start, n: BALL_TOTAL }
})()
export const isoOfBall = (b) => {
  let lo = 0, hi = balls.isos.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; balls.start[m] <= b ? (lo = m) : (hi = m - 1) }
  return balls.isos[lo]
}

// 顏色：從 quake5 色票等距取 8 色，特獎珊瑚紅、哈哈獎藍
const QUAKE5 = ['#3b6e8f', '#5fae8e', '#ffd000', '#ff8c42', '#ff4f6d']
export const NODATA = '#4a4b48'
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
function rampColor(colors, t) {
  const x = Math.min(1, Math.max(0, t)) * (colors.length - 1)
  const i = Math.min(colors.length - 2, Math.floor(x))
  const a = hex(colors[i]), b = hex(colors[i + 1])
  return '#' + a.map((v, j) => Math.round(v + (b[j] - v) * (x - i)).toString(16).padStart(2, '0')).join('')
}

// 中／英切換（預設中文）
export const TIER_ZH = ['特獎', '頭獎', '二獎', '三獎', '四獎', '五獎', '六獎', '哈哈獎']
export const TIER_EN = ['GRAND', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', 'BOOBY']
export const TIER_EN_FULL = ['Grand Prize', '1st Prize', '2nd Prize', '3rd Prize', '4th Prize', '5th Prize', '6th Prize', 'Booby Prize']
const TIER_NAMES = TIER_EN_FULL
const LAST = TIER_NAMES.length - 1
const CUTS = tierMeta.cuts // 每一級最低的 HDI 千分位（整數，避免浮點誤差）
export const TIER_R = tierMeta.r
export const tierOfHdi = (v) => { const h = Math.round(v * 1000); return CUTS.findIndex((c) => h >= c) }
const f3 = (h) => (h / 1000).toFixed(3)
export const tierIdx = (iso) => (C[iso].hdi == null ? -1 : tierOfHdi(C[iso].hdi))
export const TIERS = TIER_NAMES.map((_, i) => ({
  get name() { return L(TIER_EN_FULL[i], TIER_ZH[i]) }, en: TIER_EN_FULL[i], color: rampColor(QUAKE5, 1 - i / LAST),
  range: i === 0 ? `≥ ${f3(CUTS[0])}` : i === LAST ? `≤ ${f3(CUTS[LAST - 1] - 1)}` : CUTS[i] === CUTS[i - 1] - 1 ? f3(CUTS[i]) : `${f3(CUTS[i])}–${f3(CUTS[i - 1] - 1)}`,
  p: 0, n: 0, balls: 0,
}))
export const noHdi = { n: 0, p: 0, balls: 0 }
for (const iso of ISOS) { const t = TIERS[tierIdx(iso)] ?? noHdi; t.p += C[iso].p; t.n++; t.balls += BALLS[iso] }
export const nameOf = (iso) => L(C[iso].name_en, C[iso].name_zh ?? C[iso].name_en)
export const noHdiNames = () => ISOS.filter((iso) => tierIdx(iso) < 0).map(nameOf).join(L(', ', '、'))
export const prizeOf = (iso) => TIERS[tierIdx(iso)]?.name ?? L('Redraw', '重抽')
export const colorOf = (iso) => TIERS[tierIdx(iso)]?.color ?? NODATA
export const RANKED = ISOS.filter((iso) => C[iso].hdi != null).sort((a, b) => C[b].hdi - C[a].hdi)
// 照人口比例算的 HDI 期望值（沒有 HDI 的不算；跟 Day 25 一樣）
export const HDI_EXPECT = RANKED.reduce((s, iso) => s + C[iso].p * C[iso].hdi, 0) / (1 - noHdi.p)

// 模式：地圖、彩球、排列、格子、盒子・地圖、盒子・照獎、遊戲（預設遊戲）
export const MODES = [['map', 'Map', '地圖'], ['balls', 'Balls', '彩球'], ['grid', 'Sorted', '排列'], ['box', 'Box by Region', '盒子・照地區'], ['boxp', 'Box by Prize', '盒子・照獎'], ['game', 'Game', '遊戲']]
  .map(([key, en, zh]) => ({ key, get label() { return L(en, zh) } }))
export const mode = ref('game')
// 排列、格子模式：球排在框裡，不畫地圖
export const onBoard = () => mode.value === 'grid' || mode.value === 'cells'
// 用 MapLibre 畫的模式（其他是 3D）
export const MAP_MODES = ['map', 'balls', 'grid', 'cells']

// 兩個機率：抽到這一獎、抽到這一國；地圖模式照人口，其他模式照球數
// 抽到重抽（沒有 HDI）會再抽，所以分母扣掉重抽的部分
const ballMode = () => mode.value !== 'map'
export const pTier = (t) => (ballMode() ? t.balls / (BALL_TOTAL - noHdi.balls) : t.p / (1 - noHdi.p))
export const pIso = (iso) => (tierIdx(iso) < 0 ? 0 : ballMode() ? BALLS[iso] / (BALL_TOTAL - noHdi.balls) : C[iso].p / (1 - noHdi.p))

// 抽籤（遊戲模式以外）：地圖模式照人口（累積機率上二分搜尋），彩球類模式從全部球裡抽一顆
const cum = []
ISOS.reduce((s, iso) => (cum.push(s + C[iso].p), s + C[iso].p), 0)
export function drawOne() {
  const r = Math.random() * cum.at(-1)
  let lo = 0, hi = cum.length - 1
  while (lo < hi) { const m = (lo + hi) >> 1; cum[m] < r ? (lo = m + 1) : (hi = m) }
  return ISOS[lo]
}
export function drawBall() {
  const b = Math.floor(Math.random() * BALL_TOTAL)
  return [isoOfBall(b), b]
}

// 格子排法（盒子・地圖模式用）：cellOf[b]＝第 b 顆球在第幾格
export { cellMeta }
export const cellOf = Int32Array.from(cellMeta.cell)
export const cellsSnap = shallowRef(Int32Array.from(cellOf))

// 排列模式、盒子・照獎的順序：獎項（特獎→哈哈獎→重抽）→ 同一級 HDI 高到低 → 人口多到少；同一國的球排在一起
// gridOrder[k]＝排第 k 的是第幾顆球；gridRank[b]＝第 b 顆球排第幾
export const gridOrder = balls.isos.map((iso, k) => k)
  .sort((a, b) => ((tierIdx(balls.isos[a]) + 99) % 99) - ((tierIdx(balls.isos[b]) + 99) % 99) || (C[balls.isos[b]].hdi ?? 0) - (C[balls.isos[a]].hdi ?? 0) || C[balls.isos[b]].pop - C[balls.isos[a]].pop)
  .flatMap((k) => Array.from({ length: balls.start[k + 1] - balls.start[k] }, (_, j) => balls.start[k] + j))
export const gridRank = new Int32Array(BALL_TOTAL)
gridOrder.forEach((b, k) => (gridRank[b] = k))
// 盒子・照獎每一格的淡色：特獎→哈哈獎，最後一個（索引 -1）是沒有 HDI 的灰色
export const BOX_PASTEL = ['#ff9aa2', '#ffb870', '#ffe066', '#a8e07a', '#6fd6c0', '#7fb8f0', '#a99cf0', '#f29ad8', '#c8c8c4']
// 盒子・照獎：隔板（每一獎交界，階梯形）、色框（每一獎從第幾格到第幾格）
export const boxRank = (() => {
  // 獎項交界在第 k 格（第 r 列第 c 欄）：隔板走 r 列上緣（c 欄以右）、c 欄的直線（r 列）、r＋1 列上緣（c 欄以左）
  const cols = cellMeta.cols, walls = [], frames = []
  gridOrder.forEach((b, k) => {
    if (!k || tierIdx(isoOfBall(b)) !== tierIdx(isoOfBall(gridOrder[k - 1]))) frames.push({ color: BOX_PASTEL.at(tierIdx(isoOfBall(b))), from: k, to: k })
    else frames.at(-1).to = k
    if (!k || tierIdx(isoOfBall(b)) === tierIdx(isoOfBall(gridOrder[k - 1]))) return
    const r = Math.floor(k / cols), c = k % cols
    walls.push([[c, r], [cols, r]])
    if (c) walls.push([[c, r], [c, r + 1]], [[0, r + 1], [c, r + 1]])
  })
  return { cells: gridRank, walls, frames }
})()
export const fmtP = (p) => (p >= 0.001 || p === 0 ? `${(p * 100).toFixed(1)}%` : `${(p * 100).toPrecision(2)}%`)
export const oneIn = (p) => Math.round(1 / p).toLocaleString('en-US')

// 每國球的顏色（獎項色）
export const colors = Object.fromEntries(ISOS.map((iso) => [iso, colorOf(iso)]))

// 國旗：flags.png 拼圖裡那一國的那一格（CSS 背景位置）
export const flagStyle = (iso) => {
  const k = flagMeta.isos.indexOf(iso), { cols, rows } = flagMeta
  return { backgroundImage: `url(${flagsUrl})`, backgroundSize: `${cols * 100}% ${rows * 100}%`, backgroundPosition: `${((k % cols) / (cols - 1)) * 100}% ${(Math.floor(k / cols) / (rows - 1)) * 100}%` }
}

// 點一顆球的說明（HTML）
export function ballTip(b) {
  const iso = isoOfBall(b), c = C[iso], t = TIERS[tierIdx(iso)]
  const k = balls.isos.indexOf(iso)
  return [
    `<b>${nameOf(iso)}</b>`,
    `<b style="color:${colorOf(iso)}">${prizeOf(iso)}</b>${t ? ` (HDI ${t.range})` : L(' (no HDI — drawn again)', '（沒有 HDI，抽到再抽一次）')}`,
    ...(t ? [L(`Odds of this country <b>${fmtP(pIso(iso))}</b> (about 1 in ${oneIn(pIso(iso))})`, `抽到這一國 <b>${fmtP(pIso(iso))}</b>（約 1/${oneIn(pIso(iso))}）`)] : []),
    `HDI ${c.hdi?.toFixed(3) ?? '—'}${c.hdi_rank ? L(` (UNDP rank #${c.hdi_rank})`, `（UNDP 第 ${c.hdi_rank} 名）`) : ''}`,
    L(`Ball ${b - balls.start[k] + 1} of this country's ${BALLS[iso]}`, `彩球 ${BALLS[iso]} 顆・這是這一國的第 ${b - balls.start[k] + 1} 顆`),
    mode.value === 'grid' || mode.value === 'boxp' ? L(`Sorted #${gridRank[b] + 1} of ${BALL_TOTAL} (from top left)`, `排列第 ${gridRank[b] + 1} 顆（共 ${BALL_TOTAL} 顆，從左上數）`)
      : L(`Ball #${b + 1} of ${BALL_TOTAL}`, `全部第 ${b + 1} 顆（共 ${BALL_TOTAL} 顆）`),
  ].join('<br>')
}
