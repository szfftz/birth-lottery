// 字太長就縮小，不要換行、不要被蓋到：估一段字大概幾個「全形字」寬，超過放得下的寬度就照比例縮
// 中日韓字算 1、英文大寫 0.68、小寫和數字 0.56、空白 0.3（粗體圓體的大概寬度）
export const textUnits = (s) => [...String(s)].reduce((n, ch) => n + (/[ᄀ-ￜ]/.test(ch) ? 1 : /[A-Z]/.test(ch) ? 0.68 : ch === ' ' ? 0.3 : 0.56), 0)
/** cap＝原本字級下放得下幾個全形字；回傳縮放倍數（最小 min，再小就看不清楚，那時候才換行） */
export const fitScale = (s, cap, min = 0.45) => Math.max(min, Math.min(1, cap / textUnits(s)))
export const needsWrap = (s, cap, min = 0.45) => textUnits(s) * min > cap
/** 給元素用的 style：字太長就設 --fit（CSS 裡 font-size: calc(原本的大小 * var(--fit, 1))） */
export const fit = (s, cap, min = 0.5) => ({ '--fit': fitScale(s, cap, min) })
