// 手機拿著的角度：從 devicemotion 的「含重力加速度」算出手機往左右、前後歪了多少（不用另外問權限，跟搖手機共用同一個事件）。
// 視角跟著手機的角度走：歪著拿，視角就一直停在那一邊。基準只會很慢很慢跟上（約 20 秒），所以躺著、斜著拿久了也會回到正面。
// tilt.x＝左右、tilt.y＝前後，大約 -1～1（歪 20° 左右就到底）
export const tilt = { x: 0, y: 0 }

const IOS = typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission === 'function' // iPhone 的正負號跟 Android 相反
const FULL = 0.35 // 重力分量差這麼多（約 20°）就算歪到底
let bx = null, by = 0, lastT = 0
export function feedTilt(e) {
  const g = e.accelerationIncludingGravity
  if (!g || g.x == null) return
  const s = IOS ? -1 : 1, x = (s * g.x) / 9.81, y = (s * g.y) / 9.81
  const now = performance.now(), dt = lastT ? Math.min(0.2, (now - lastT) / 1000) : 0
  lastT = now
  if (bx == null) { bx = x; by = y }
  const k = Math.min(1, dt / 20)
  bx += (x - bx) * k; by += (y - by) * k
  tilt.x = Math.max(-1, Math.min(1, (x - bx) / FULL))
  tilt.y = Math.max(-1, Math.min(1, (y - by) / FULL))
}
