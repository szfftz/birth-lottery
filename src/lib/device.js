// 手機、平板（觸控螢幕）：3D 畫面用比較省的設定（解析度、影子、球的面數、材質），畫面才不會卡。CSS 裡對應的是 @media (pointer: coarse)
export const LOW = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
