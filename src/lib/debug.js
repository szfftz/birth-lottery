// 除錯面板（暫時）：網址後面加 ?debug 才出現，畫面左下角一塊小字，寫這台手機的狀況、最近發生的事。
// 手機上有問題時截圖這一塊，就知道是哪一步出錯（按鈕有沒有收到、3D 有沒有起來、每秒畫幾格）
import { reactive } from 'vue'

// 效能數字（每一台都記，不用 ?debug）：顯示在「說明」最下面版本號旁邊，手機卡的時候截那一行就知道卡在哪
// idle／spin＝靜止、搖獎時每秒幾格；ratio＝3D 解析度倍數；phys＝物理每格幾毫秒；low＝手機省電版；gpu＝顯示晶片
export const perf = reactive({ idle: 0, spin: 0, ratio: 0, phys: 0, low: false, gpu: '' })

export const DEBUG = typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)
const info = {} // 固定的資訊（裝置、3D）
const log = [] // 最近發生的事
let box = null, frames = 0, fps = 0, lastFrame = 0, worst = 0

function render() {
  if (!box) return
  const head = Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n')
  box.textContent = `${head}\nfps: ${fps}（最慢一格 ${worst}ms）\n— 最近 —\n${log.slice(-9).join('\n')}`
}
/** 記一筆固定資訊 */
export function dbgInfo(k, v) { if (DEBUG) { info[k] = v; render() } }
/** 記一件事（前面加秒數） */
export function dbg(msg) { if (DEBUG) { log.push(`${(performance.now() / 1000).toFixed(1)}s ${msg}`); render() } }

if (DEBUG) {
  const start = () => {
    box = document.createElement('pre')
    box.style.cssText = 'position:fixed;left:6px;bottom:96px;z-index:9998;max-width:92vw;margin:0;padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#7CFC9A;font:10px/1.35 monospace;white-space:pre-wrap;word-break:break-all;pointer-events:none'
    document.body.appendChild(box)
    info.ua = navigator.userAgent.replace(/Mozilla\/5\.0 |AppleWebKit\S+ |\(KHTML, like Gecko\) /g, '').slice(0, 110)
    info.螢幕 = `${innerWidth}×${innerHeight} @${devicePixelRatio}x　觸控:${matchMedia('(pointer: coarse)').matches}　https:${location.protocol === 'https:'}`
    render()
    // 手指、點擊落在哪個東西上（看按鈕有沒有收到）
    const name = (t) => (t?.closest?.('button')?.className || t?.className || t?.tagName || '?').toString().slice(0, 28)
    for (const ev of ['pointerdown', 'pointerup', 'click', 'touchend']) window.addEventListener(ev, (e) => dbg(`${ev} → ${name(e.target)}`), true)
    const tick = (t) => {
      frames++
      if (lastFrame) worst = Math.max(worst, Math.round(t - lastFrame))
      lastFrame = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    setInterval(() => { fps = frames; frames = 0; render(); worst = 0 }, 1000)
  }
  if (document.body) start(); else addEventListener('DOMContentLoaded', start)
}
