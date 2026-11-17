// 語言切換：中文（預設）、英文、日文、韓文，選過的記在瀏覽器。
// L(英文, 中文, 日文, 韓文) 照目前語言回傳其中一個（在 template、computed 裡用就會跟著切換）；日、韓沒給就用英文
import { ref, watch } from 'vue'

export const LANGS = [['zh', '中', 'zh-Hant-TW'], ['en', 'EN', 'en'], ['ja', '日', 'ja'], ['ko', '한', 'ko']]
const KEY = 'birth-lottery:lang'
let saved = null
try { saved = localStorage.getItem(KEY) } catch { /* 讀不到就用預設 */ }
export const lang = ref(LANGS.some(([k]) => k === saved) ? saved : 'zh')
watch(lang, (v) => {
  try { localStorage.setItem(KEY, v) } catch { /* 存不了就算了 */ }
  document.documentElement.lang = LANGS.find(([k]) => k === v)[2]
}, { immediate: true })
export const L = (en, zh, ja, ko) => ({ zh, ja, ko })[lang.value] ?? en
// 中日韓（字比較方、不用複數、獎牌不寫 PRIZE）
export const isCJK = () => lang.value !== 'en'
