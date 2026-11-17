// 搖手機也會搖獎：手機的加速度（扣掉重力）超過門檻算「甩一下」；同一下會連續好幾筆超過，所以兩下之間至少隔 150ms，
// 1.2 秒內甩 3 下才算（放下手機、走路、碰一下都不算）。
// Android 不用權限，一打開就能搖；iPhone 要在使用者按按鈕時呼叫 enable() 問「動作與方向」權限（而且要 https）
import { onBeforeUnmount, ref } from 'vue'

const MIN = 13, GAP = 150, WINDOW = 1200, HITS = 3

/** @param {{ canShake: () => boolean, onShake: () => void }} opt  canShake：現在能不能搖（搖獎中、剛搖完…就不行）
 *  回傳 enable()（iPhone 要在按按鈕時呼叫）、ready（這台裝置現在能用搖的） */
export function useShake({ canShake, onShake }) {
  let on = false, hits = []
  // ready：真的收到手機的動作資料了（電腦有這個 API 但不會有資料；iPhone 要按過、允許之後才有）
  const ready = ref(false)
  function onMotion(e) {
    if (!ready.value) { const a = e.accelerationIncludingGravity ?? e.acceleration; if (a && a.x != null) ready.value = true }
    if (!canShake()) { hits = []; return }
    let m
    const a = e.acceleration
    if (a && a.x != null) m = Math.hypot(a.x, a.y, a.z) // 已經扣掉重力
    else {
      const g = e.accelerationIncludingGravity
      if (!g || g.x == null) return
      m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81)
    }
    if (m < MIN) return
    const now = performance.now()
    hits = hits.filter((t) => now - t < WINDOW)
    if (hits.length && now - hits.at(-1) < GAP) return
    hits.push(now)
    if (hits.length >= HITS) {
      hits = []
      navigator.vibrate?.(40)
      onShake()
    }
  }
  function listen() { on = true; window.addEventListener('devicemotion', onMotion) }
  // 不管怎樣都不能擋到按鈕：出錯就算了
  function enable() {
    try {
      if (on || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
      const ask = window.DeviceMotionEvent.requestPermission
      if (typeof ask === 'function') Promise.resolve(ask.call(window.DeviceMotionEvent)).then((r) => r === 'granted' && listen()).catch(() => {})
      else listen()
    } catch { /* 沒有就沒有 */ }
  }
  if (typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission !== 'function') enable()
  onBeforeUnmount(() => window.removeEventListener('devicemotion', onMotion))
  return { enable, ready }
}
