// 整個 app 共用的狀態：抽過的結果（存在 localStorage）、這次抽到誰、搖獎中、面板開關；各元件直接 import
import { computed, reactive, ref, watch } from 'vue'
import { L } from './i18n.js'
import { C, mode, tierIdx } from './lottery.js'

export const counts = reactive({}) // 每一國抽中幾次
export const history = reactive([]) // 每一次抽的結果：{ n, iso, ball, time }
export const historyDesc = computed(() => history.slice().reverse())
export const total = ref(0)
export const last = ref(null) // 這次抽到（或在清單上點選）的國家
export const lastBall = ref(null) // 這次掉出來的是第幾顆球（點清單選的國家沒有球）
export const lastN = ref(null) // 現在看的是第幾次投胎（剛抽完＝最新一次；點歷史＝那一次；點國家清單＝沒有）
export const rerolls = ref(0) // 抽到沒有 HDI 的國家（摩納哥、梵蒂岡）就自動再搖，不算投胎次數
export const lastRerolls = ref(0)
export const spinning = ref(false) // 搖獎中
export const sheet = ref(false) // 資訊面板開著沒
export const tab = ref('result') // 資訊面板的分頁
export const menu = ref(false) // 左上的模式選單開著沒
export const showTally = ref(false) // 地圖：抽過的圓開不開（預設關）

// 歷史存在 localStorage：重新整理還在；載入時用它重建次數、各國中幾次、最後一次
const HISTORY_KEY = 'birth-lottery:history'
try {
  const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  for (const h of Array.isArray(saved) ? saved : []) {
    if (!h || !C[h.iso]) continue
    history.push({ n: history.length + 1, iso: h.iso, ball: Number.isInteger(h.ball) ? h.ball : null, time: String(h.time ?? '') })
    counts[h.iso] = (counts[h.iso] ?? 0) + 1
  }
  total.value = history.length
  last.value = history.at(-1)?.iso ?? null
  lastN.value = history.length || null
} catch { /* 讀不到就從空的開始 */ }
watch(history, () => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* 存不了就算了 */ } })

export function openSheet(t) {
  if (t) tab.value = t
  sheet.value = true
}
// 換頁（搖獎中不能換）；抽到的那顆球留著，下一次抽才換
export function setMode(m) {
  if (spinning.value) return
  mode.value = m
}
// 點清單：只把它標成「這次」，不算一次投胎
export function pick(iso) {
  lastRerolls.value = 0
  last.value = iso
  lastBall.value = null
  lastN.value = null
}
// 點歷史裡的一筆：回到那一次的結果（第幾次、哪一國、哪一顆球），打開結果分頁看詳細資料
export function pickDraw(h) {
  lastRerolls.value = 0
  last.value = h.iso
  lastBall.value = h.ball
  lastN.value = h.n
  tab.value = 'result'
}
// 記一次投胎：iso＝抽到的國家、ball＝第幾顆球、redraws＝先掉出幾次重抽球
export function record(iso, ball, redraws) {
  rerolls.value += redraws
  lastRerolls.value = redraws
  counts[iso] = (counts[iso] ?? 0) + 1
  total.value++
  history.push({ n: total.value, iso, ball, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) })
  last.value = iso
  lastBall.value = ball
  lastN.value = total.value
}
export function clearHistory() {
  if (spinning.value || !history.length || !confirm(L('Clear all draw history?', '確定要清空所有抽過的結果？', '抽選の履歴をすべて消しますか？', '뽑기 기록을 모두 지울까요?'))) return
  history.splice(0)
  for (const k of Object.keys(counts)) delete counts[k]
  total.value = 0; rerolls.value = 0; lastRerolls.value = 0
  last.value = null; lastBall.value = null; lastN.value = null
}

// 統計（獎項分頁）
export const drawnMean = computed(() => {
  let s = 0, n = 0
  for (const [iso, k] of Object.entries(counts)) if (C[iso].hdi != null) { s += C[iso].hdi * k; n += k }
  return n ? s / n : 0
})
const drawnRanked = computed(() => Object.keys(counts).filter((iso) => C[iso].hdi != null).sort((a, b) => C[b].hdi - C[a].hdi))
export const best = computed(() => drawnRanked.value[0])
export const worst = computed(() => drawnRanked.value.at(-1))
export const drawnByTier = computed(() => {
  const out = {}
  for (const [iso, n] of Object.entries(counts)) out[tierIdx(iso)] = (out[tierIdx(iso)] ?? 0) + n
  return out
})
export const topDrawn = computed(() => Object.entries(counts).map(([iso, n]) => ({ iso, n })).sort((a, b) => b.n - a.n).slice(0, 8))
