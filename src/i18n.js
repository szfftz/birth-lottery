// 語言切換：中文（預設）、英文、日文、韓文，選過的記在瀏覽器。
// L(英文, 中文, 日文, 韓文) 照目前語言回傳其中一個（在 template、computed 裡用就會跟著切換）；日、韓沒給就用英文
import { ref, watch } from 'vue'

// [代碼, 用哪一國的國旗球當按鈕, html lang, 按鈕的名字（給螢幕閱讀器）]：中文照台灣說法、英文照英國用法和拼法
export const LANGS = [['zh', 'TWN', 'zh-Hant-TW', '中文'], ['en', 'GBR', 'en-GB', 'English'], ['ja', 'JPN', 'ja', '日本語'], ['ko', 'KOR', 'ko', '한국어']]
const KEY = 'birth-lottery:lang'
let saved = null
try { saved = localStorage.getItem(KEY) } catch { /* 讀不到就用預設 */ }
export const lang = ref(LANGS.some(([k]) => k === saved) ? saved : 'zh')
watch(lang, (v) => {
  try { localStorage.setItem(KEY, v) } catch { /* 存不了就算了 */ }
  if (typeof document !== 'undefined') document.documentElement.lang = LANGS.find(([k]) => k === v)[2] // 測試（沒有網頁）時跳過
}, { immediate: true })
export const L = (en, zh, ja, ko) => ({ zh, ja, ko })[lang.value] ?? en
// 中日韓（字比較方、不用複數、獎牌不寫 PRIZE）
export const isCJK = () => lang.value !== 'en'
