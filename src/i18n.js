// 中／英切換：預設中文，選過的記在瀏覽器。L(英文, 中文) 照目前語言回傳其中一個（在 template、computed 裡用就會跟著切換）
import { ref, watch } from 'vue'

const KEY = 'birth-lottery:lang'
let saved = null
try { saved = localStorage.getItem(KEY) } catch { /* 讀不到就用預設 */ }
export const lang = ref(saved === 'en' ? 'en' : 'zh')
watch(lang, (v) => {
  try { localStorage.setItem(KEY, v) } catch { /* 存不了就算了 */ }
  document.documentElement.lang = v === 'zh' ? 'zh-Hant-TW' : 'en'
}, { immediate: true })
export const L = (en, zh) => (lang.value === 'zh' ? zh : en)
