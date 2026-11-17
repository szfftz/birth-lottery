import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './styles/app.css'
import { dbg } from './lib/debug.js'

// 除錯用（暫時）：手機上出錯時把錯誤訊息直接顯示在畫面最上面，方便截圖回報
function showError(msg) {
  let box = document.getElementById('err-box')
  if (!box) {
    box = document.createElement('div')
    box.id = 'err-box'
    box.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:9999;max-height:40vh;overflow:auto;padding:8px 10px;border-radius:10px;background:rgba(160,0,20,.92);color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;word-break:break-all'
    box.onclick = () => box.remove()
    document.body.appendChild(box)
  }
  box.textContent += (box.textContent ? '\n' : '') + String(msg).slice(0, 400)
  dbg(`錯誤：${String(msg).slice(0, 120)}`)
}
window.addEventListener('error', (e) => showError(`${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', (e) => showError(`Promise: ${e.reason?.stack || e.reason}`))

const app = createApp(App)
app.config.errorHandler = (err, _vm, info) => { showError(`Vue (${info}): ${err?.stack || err}`); console.error(err) }
app.mount('#app')
