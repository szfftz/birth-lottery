// 投胎樂透的資料與計算（從 K30DayMapChallenge Day 25 搬過來，只留遊戲模式要用的）
// 機率＝球數比例（遊戲是真的從 891 顆球裡掉一顆出來）；獎項依 HDI 切 8 級（build_tiers.py 挑切點，機率盡量接近 1:2:4:…:128）
import data from './data/lottery.json'
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

const TIER_NAMES = ['特獎', '頭獎', '二獎', '三獎', '四獎', '五獎', '六獎', '哈哈獎']
// 舞台上用英文
export const TIER_EN = ['GRAND', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', 'BOOBY']
export const TIER_EN_FULL = ['Grand Prize', '1st Prize', '2nd Prize', '3rd Prize', '4th Prize', '5th Prize', '6th Prize', 'Booby Prize']
const LAST = TIER_NAMES.length - 1
const CUTS = tierMeta.cuts // 每一級最低的 HDI 千分位（整數，避免浮點誤差）
export const TIER_R = tierMeta.r
export const tierOfHdi = (v) => { const h = Math.round(v * 1000); return CUTS.findIndex((c) => h >= c) }
const f3 = (h) => (h / 1000).toFixed(3)
export const tierIdx = (iso) => (C[iso].hdi == null ? -1 : tierOfHdi(C[iso].hdi))
export const TIERS = TIER_NAMES.map((name, i) => ({
  name, en: TIER_EN_FULL[i], color: rampColor(QUAKE5, 1 - i / LAST),
  range: i === 0 ? `${f3(CUTS[0])} 以上` : i === LAST ? `${f3(CUTS[LAST - 1] - 1)} 以下` : CUTS[i] === CUTS[i - 1] - 1 ? f3(CUTS[i]) : `${f3(CUTS[i])}–${f3(CUTS[i - 1] - 1)}`,
  p: 0, n: 0, balls: 0,
}))
export const noHdi = { n: 0, p: 0, balls: 0 }
for (const iso of ISOS) { const t = TIERS[tierIdx(iso)] ?? noHdi; t.p += C[iso].p; t.n++; t.balls += BALLS[iso] }
export const nameOf = (iso) => C[iso].name_zh ?? C[iso].name_en
export const noHdiNames = ISOS.filter((iso) => tierIdx(iso) < 0).map(nameOf).join('、')
export const prizeOf = (iso) => TIERS[tierIdx(iso)]?.name ?? '重抽'
export const colorOf = (iso) => TIERS[tierIdx(iso)]?.color ?? NODATA
export const RANKED = ISOS.filter((iso) => C[iso].hdi != null).sort((a, b) => C[b].hdi - C[a].hdi)
// 照人口比例算的 HDI 期望值（沒有 HDI 的不算；跟 Day 25 一樣）
export const HDI_EXPECT = RANKED.reduce((s, iso) => s + C[iso].p * C[iso].hdi, 0) / (1 - noHdi.p)

// 兩個機率：抽到這一獎、抽到這一國（照球數；抽到重抽會再抽，所以分母扣掉重抽的球）
export const pTier = (t) => t.balls / (BALL_TOTAL - noHdi.balls)
export const pIso = (iso) => (tierIdx(iso) < 0 ? 0 : BALLS[iso] / (BALL_TOTAL - noHdi.balls))
export const fmtP = (p) => (p >= 0.001 || p === 0 ? `${(p * 100).toFixed(1)}%` : `${(p * 100).toPrecision(2)}%`)
export const oneIn = (p) => Math.round(1 / p).toLocaleString()

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
    `<b>${nameOf(iso)}</b> <span class="en">${c.name_en}</span>`,
    `<b style="color:${colorOf(iso)}">${prizeOf(iso)}</b>${t ? `（HDI ${t.range}）` : '（沒有 HDI，抽到再抽一次）'}`,
    ...(t ? [`抽到這一國 <b>${fmtP(pIso(iso))}</b>（約 1/${oneIn(pIso(iso))}）`] : []),
    `HDI ${c.hdi?.toFixed(3) ?? '—'}${c.hdi_rank ? `（UNDP 第 ${c.hdi_rank} 名）` : ''}`,
    `彩球 ${BALLS[iso]} 顆・第 ${b - balls.start[k] + 1} 顆`,
  ].join('<br>')
}
