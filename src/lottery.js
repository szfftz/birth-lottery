// 出生搖搖樂的資料與計算（從 K30DayMapChallenge Day 25 搬過來，只留遊戲模式要用的）
// 機率＝球數比例（遊戲是真的從 891 顆球裡掉一顆出來）；獎項依 HDI 切 8 級（build_tiers.py 挑切點，機率盡量接近 1:2:4:…:128）
import { L, lang } from './i18n.js'
import { ref } from 'vue'
import data from './data/lottery.json'
import cellMeta from './data/cells.json'
import wiki from './data/wiki.json'
import ballMeta from './data/balls.json'
import tierMeta from './data/tiers.json'
import namesJaKo from './data/names_jako.json' // 日文、韓文國名（Natural Earth，少數改成常用簡稱）
import flagMeta from './data/flags.json'
import flagsUrl from './data/flags.png?url'

export const { meta, countries: C } = data
export const ISOS = Object.keys(C) // 人口由多到少
export { flagMeta, flagsUrl }

// 彩球：總共 891 顆，每國至少 1 顆，其他照人口分（1 顆＝平均人數）
export const POP_UNIT = 1e7 // 畫面上寫的「1 顆球大約幾個人」：只是大概的數字（實際平均約 982 萬），不拿來算球數
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

// 8 個獎的顏色：跟 Day 1 地震 5 級同一套色（藍 #3b6e8f → 青綠 #5fae8e → 黃 #ffd000 → 橘 #ff8c42 → 粉紅 #ff4f6d），中間補 3 色。
// 不用內插：內插出來的中間色會灰灰髒髒的，每一色都挑過、色相明度拉開（由低到高：哈哈獎 → 特獎）
const TIER_COLORS = ['#3b6e8f', '#3f93a6', '#5fae8e', '#a9c75b', '#ffd000', '#ff9f3a', '#ff6b55', '#ff3f74']
export const NODATA = '#3a3440' // 沒資料的國家（格陵蘭、南極…）：深灰紫，不要搶眼

// 獎項名稱：中、英、日、韓
export const TIER_ZH = ['特獎', '頭獎', '二獎', '三獎', '四獎', '五獎', '六獎', '哈哈獎']
export const TIER_EN = ['GRAND', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', 'BOOBY']
export const TIER_EN_FULL = ['Grand Prize', '1st Prize', '2nd Prize', '3rd Prize', '4th Prize', '5th Prize', '6th Prize', 'Booby Prize']
export const TIER_JA = ['特賞', '1等', '2等', '3等', '4等', '5等', '6等', '残念賞']
export const TIER_KO = ['특등', '1등', '2등', '3등', '4등', '5등', '6등', '꽝']
const TIER_JA_FULL = ['特賞', '1等賞', '2等賞', '3等賞', '4等賞', '5等賞', '6等賞', '残念賞']
const TIER_KO_FULL = ['특등상', '1등상', '2등상', '3등상', '4등상', '5등상', '6등상', '꽝']
// 獎牌上的短名（照目前語言）
export const tierShort = (i) => L(TIER_EN[i], TIER_ZH[i], TIER_JA[i], TIER_KO[i])
const TIER_NAMES = TIER_EN_FULL
const LAST = TIER_NAMES.length - 1
const CUTS = tierMeta.cuts // 每一級最低的 HDI 千分位（整數，避免浮點誤差）
export const TIER_R = tierMeta.r
export const tierOfHdi = (v) => { const h = Math.round(v * 1000); return CUTS.findIndex((c) => h >= c) }
const f3 = (h) => (h / 1000).toFixed(3)
export const tierIdx = (iso) => (C[iso].hdi == null ? -1 : tierOfHdi(C[iso].hdi))
export const TIERS = TIER_NAMES.map((_, i) => ({
  get name() { return L(TIER_EN_FULL[i], TIER_ZH[i], TIER_JA_FULL[i], TIER_KO_FULL[i]) }, en: TIER_EN_FULL[i], color: TIER_COLORS[LAST - i],
  range: i === 0 ? `≥ ${f3(CUTS[0])}` : i === LAST ? `≤ ${f3(CUTS[LAST - 1] - 1)}` : CUTS[i] === CUTS[i - 1] - 1 ? f3(CUTS[i]) : `${f3(CUTS[i])}–${f3(CUTS[i - 1] - 1)}`,
  p: 0, n: 0, balls: 0,
}))
export const noHdi = { n: 0, p: 0, balls: 0 }
for (const iso of ISOS) { const t = TIERS[tierIdx(iso)] ?? noHdi; t.p += C[iso].p; t.n++; t.balls += BALLS[iso] }
// 中文國名用台灣常用的簡稱（資料裡是正式全名）
const ZH_SHORT = { CHN: '中國', TWN: '臺灣', KOR: '南韓', PRK: '北韓', IDN: '印尼', COD: '民主剛果', COG: '剛果', SAU: '沙烏地', ARE: '阿聯', CZE: '捷克',
  MLI: '馬利', CAF: '中非', PNG: '巴紐', PSX: '巴勒斯坦', BIH: '波赫', TTO: '千里達', STP: '聖多美', VCT: '聖文森', ATG: '安地卡', KNA: '聖克里斯多福',
  FSM: '密克羅尼西亞', MNG: '蒙古' }
// 英、日、韓也用各國常用的簡稱（正式全名太長，手機上放不下）
const EN_SHORT = { COD: 'DR Congo', COG: 'Congo', ARE: 'UAE', DOM: 'Dominican Rep.', CAF: 'Central African Rep.', BIH: 'Bosnia & Herzegovina', TTO: 'Trinidad & Tobago',
  STP: 'São Tomé & Príncipe', VCT: 'St Vincent', ATG: 'Antigua & Barbuda', KNA: 'St Kitts & Nevis' }
const JA_SHORT = { BIH: 'ボスニア', TTO: 'トリニダード・トバゴ', STP: 'サントメ・プリンシペ', VCT: 'セントビンセント', ATG: 'アンティグア', KNA: 'セントキッツ' }
const KO_SHORT = { BIH: '보스니아', VCT: '세인트빈센트', FSM: '미크로네시아', KNA: '세인트키츠' }
export const nameOf = (iso) => L(EN_SHORT[iso] ?? C[iso].name_en, ZH_SHORT[iso] ?? C[iso].name_zh ?? C[iso].name_en, JA_SHORT[iso] ?? namesJaKo[iso]?.[0], KO_SHORT[iso] ?? namesJaKo[iso]?.[1])
// 地圖上的國家（含不在人口表裡的地區）：日韓用 Natural Earth 的名字
export const mapNameOf = (iso, en, zh) => L(en, zh ?? en, namesJaKo[iso]?.[0], namesJaKo[iso]?.[1])
export const noHdiNames = () => ISOS.filter((iso) => tierIdx(iso) < 0).map(nameOf).join(L(', ', '、', '、', ', '))
export const prizeOf = (iso) => TIERS[tierIdx(iso)]?.name ?? L('Redraw', '重抽', '引き直し', '다시 뽑기')
// 地圖的顏色：照人類發展指數由低到高連續變色，不分級；沒有指數的國家用灰色。
// 螢光亮色，綠到紅：低＝螢光綠 → 螢光黃綠 → 螢光黃 → 螢光橘 → 高＝螢光紅（指數越高越紅）
const HDI_COLORS = ['#2dff8c', '#8dff4a', '#d8ff3a', '#fff23a', '#ffb52e', '#ff6a3d', '#ff2d5a']
const HDIS = ISOS.map((iso) => C[iso].hdi).filter((h) => h != null), HDI_LO = Math.min(...HDIS), HDI_HI = Math.max(...HDIS)
// 圖例用：指數最低、最高是多少，還有同一條漸層（CSS）
export const HDI_RANGE = [HDI_LO, HDI_HI], HDI_RAMP = `linear-gradient(90deg, ${HDI_COLORS.join(', ')})`
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
// 一個 HDI 數字的顏色（平均值也用得到）；沒有數字＝沒資料的灰
export function hdiColorOf(h) {
  if (h == null) return NODATA
  const x = Math.min(1, Math.max(0, (h - HDI_LO) / (HDI_HI - HDI_LO))) * (HDI_COLORS.length - 1), i = Math.min(HDI_COLORS.length - 2, Math.floor(x)), t = x - i
  const a = hex(HDI_COLORS[i]), b = hex(HDI_COLORS[i + 1])
  return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
export const hdiColor = (iso) => hdiColorOf(C[iso]?.hdi)
// 不顯示獎項時每一國都同一個顏色（中獎看板的光、小地圖都不分級）
const PLAIN = '#35a7b8'
export const colorOf = (iso) => (SHOW_PRIZE ? TIERS[tierIdx(iso)]?.color ?? NODATA : PLAIN)
export const RANKED = ISOS.filter((iso) => C[iso].hdi != null).sort((a, b) => C[b].hdi - C[a].hdi)
// 照人口比例算的 HDI 期望值（沒有 HDI 的不算；跟 Day 25 一樣）
export const HDI_EXPECT = RANKED.reduce((s, iso) => s + C[iso].p * C[iso].hdi, 0) / (1 - noHdi.p)

// 聯合國（UNDP）的人類發展指數排名：寫成「第幾／總共幾國」
export const RANK_TOTAL = Math.max(...ISOS.map((iso) => C[iso].hdi_rank ?? 0))
export const rankText = (iso) => (C[iso].hdi_rank
  ? L(`UNDP rank ${C[iso].hdi_rank}/${RANK_TOTAL}`, `聯合國排名 ${C[iso].hdi_rank}/${RANK_TOTAL}`, `UNDP 順位 ${C[iso].hdi_rank}/${RANK_TOTAL}`, `UNDP 순위 ${C[iso].hdi_rank}/${RANK_TOTAL}`)
  : L('Not ranked by UNDP', '不在聯合國排名', 'UNDP 順位なし', 'UNDP 순위 없음'))
// 「HDI」這個詞：中文寫全名「人類發展指數」，英、日、韓照各國習慣寫 HDI
export const hdiWord = () => L('HDI', '人類發展指數', 'HDI', 'HDI')

// 獎項（頭獎、二獎…）要不要給使用者看：false＝畫面上完全不提獎項（獎牌、獎項名稱、此獎機率、獎項彩球盒、獎項排序、說明裡的獎項段落都藏起來），
// 程式和分級的算法都留著，改回 true 就全部回來。顏色（地圖、球的底色）和抽到沒有 HDI 的國家要重抽，不受這個開關影響
export const SHOW_PRIZE = false

// 頁面：地圖、世界彩球盒、獎項彩球盒（都是從下面拉上來的面板）、遊戲（預設，搖獎機）
export const MODES = [['map', 'Map', '地圖', '地図', '지도'], ['box', 'World Box', '世界彩球盒', '世界ボール箱', '세계 공 상자'], ['boxp', 'Prize Box', '獎項彩球盒', '賞別ボール箱', '상별 공 상자'], ['game', 'Game', '遊戲', 'ゲーム', '게임']]
  .filter(([key]) => SHOW_PRIZE || key !== 'boxp')
  .map(([key, ...t]) => ({ key, get label() { return L(...t) } }))
export const mode = ref('game')

// 兩個機率：抽到這一獎、抽到這一國；地圖模式照人口，其他模式照球數
// 抽到重抽（沒有 HDI）會再抽，所以分母扣掉重抽的部分
const ballMode = () => mode.value !== 'map'
export const pTier = (t) => (ballMode() ? t.balls / (BALL_TOTAL - noHdi.balls) : t.p / (1 - noHdi.p))
export const pIso = (iso) => (tierIdx(iso) < 0 ? 0 : ballMode() ? BALLS[iso] / (BALL_TOTAL - noHdi.balls) : C[iso].p / (1 - noHdi.p))

// 世界彩球盒的排法（build_cells.py 算好）：worldCells[b]＝第 b 顆球放在第幾格（照各國在世界上的相對位置）
export { cellMeta }
export const worldCells = Int32Array.from(cellMeta.cell)

// 獎項彩球盒的順序：獎項（特獎→哈哈獎→重抽）→ 同一級 HDI 高到低 → 人口多到少；同一國的球排在一起
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
// 大數字：中日韓用「萬（万、만）／億（억）」，英文用 million / billion（一萬以下照原樣）
const trim = (x, d) => String(+x.toFixed(d))
const BIG = { zh: ['萬', '億'], ja: ['万', '億'], ko: ['만', '억'] }
// 每一國的兩個外部連結：維基百科（照語言開那個語言的條目；中文開臺灣正體）、Google 地圖（介面也照語言）
// wiki.json：國碼 → [英, 中, 日, 韓] 的條目名稱（從 Wikidata 查的）
const WIKI_HOST = { en: 'en.wikipedia.org/wiki', zh: 'zh.wikipedia.org/zh-tw', ja: 'ja.wikipedia.org/wiki', ko: 'ko.wikipedia.org/wiki' }
const MAP_HL = { en: 'en-GB', zh: 'zh-TW', ja: 'ja', ko: 'ko' }
export const wikiUrl = (iso) => `https://${WIKI_HOST[lang.value]}/${encodeURIComponent((wiki[iso]?.[['en', 'zh', 'ja', 'ko'].indexOf(lang.value)] ?? C[iso].name_en).replace(/ /g, '_'))}`
// 用英文條目名稱找（括號拿掉：「Georgia (country)」→「Georgia country」，才不會找到美國的喬治亞州）
export const gmapUrl = (iso) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((wiki[iso]?.[0] ?? C[iso].name_en).replace(/[()]/g, ''))}&hl=${MAP_HL[lang.value]}`
// 日期照語言寫：資料是「1 Jul 2026」或只有年份「2026」
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(s) {
  const m = /^(?:(\d{1,2}) ([A-Z][a-z]{2}) )?(\d{4})$/.exec(s ?? '')
  if (!m) return s ?? ''
  const [, d, mon, y] = m, mo = MON.indexOf(mon) + 1
  if (!d || !mo) return L(y, `${y} 年`, `${y}年`, `${y}년`)
  return L(s, `${y} 年 ${mo} 月 ${d} 日`, `${y}年${mo}月${d}日`, `${y}년 ${mo}월 ${d}일`)
}
export const fmtBig = (n) => {
  if (n == null) return '—'
  const u = BIG[lang.value]
  if (u) {
    if (n >= 1e8) return `${trim(n / 1e8, n >= 1e9 ? 1 : 2)} ${u[1]}`
    if (n >= 1e4) return `${n >= 1e6 ? Math.round(n / 1e4).toLocaleString('en-US') : trim(n / 1e4, 1)} ${u[0]}`
  } else {
    if (n >= 1e9) return `${trim(n / 1e9, 2)} billion`
    if (n >= 1e6) return `${trim(n / 1e6, n >= 1e8 ? 0 : 1)} million`
  }
  return Math.round(n).toLocaleString('en-US')
}
export const oneIn = (p) => fmtBig(Math.round(1 / p))

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
    ...(SHOW_PRIZE ? [`<b style="color:${colorOf(iso)}">${prizeOf(iso)}</b>${t ? `<br>${hdiWord()} ${t.range}` : L(' (no HDI — drawn again)', '（沒有人類發展指數，抽到再抽一次）', '（HDI なし・引き直し）', ' (HDI 없음 — 다시 뽑기)')}`]
      : t ? [] : [L('No HDI — drawn again', '沒有人類發展指數，抽到再抽一次', 'HDI なし・引き直し', 'HDI 없음 — 다시 뽑기')]),
    ...(t ? [L(`Odds of this country <b>${fmtP(pIso(iso))}</b> (about 1 in ${oneIn(pIso(iso))})`, `抽到此國機率 <b>${fmtP(pIso(iso))}</b>（約 1/${oneIn(pIso(iso))}）`, `この国が当たる確率 <b>${fmtP(pIso(iso))}</b>（約 ${oneIn(pIso(iso))} 分の 1）`, `이 나라가 뽑힐 확률 <b>${fmtP(pIso(iso))}</b> (약 ${oneIn(pIso(iso))}분의 1)`)] : []),
    `${hdiWord()} ${c.hdi?.toFixed(3) ?? '—'}${c.hdi_rank ? L(` (${rankText(iso)})`, `（${rankText(iso)}）`, `（${rankText(iso)}）`, ` (${rankText(iso)})`) : ''}`,
    L(`Ball ${b - balls.start[k] + 1} of this country's ${BALLS[iso]}`, `彩球 ${BALLS[iso]} 顆・這是這一國的第 ${b - balls.start[k] + 1} 顆`, `ボール ${BALLS[iso]} 個中 ${b - balls.start[k] + 1} 個目`, `공 ${BALLS[iso]}개 중 ${b - balls.start[k] + 1}번째`),
    mode.value === 'boxp' ? L(`#${gridRank[b] + 1} of ${BALL_TOTAL} in prize order`, `照獎項排第 ${gridRank[b] + 1} 顆（共 ${BALL_TOTAL} 顆）`, `賞の順で ${gridRank[b] + 1} 番目（全 ${BALL_TOTAL} 個）`, `상 순서로 ${gridRank[b] + 1}번째 (총 ${BALL_TOTAL}개)`)
      : L(`Ball #${b + 1} of ${BALL_TOTAL}`, `全部第 ${b + 1} 顆（共 ${BALL_TOTAL} 顆）`, `全体の ${b + 1} 番目（全 ${BALL_TOTAL} 個）`, `전체 ${b + 1}번째 (총 ${BALL_TOTAL}개)`),
  ].join('<br>')
}
