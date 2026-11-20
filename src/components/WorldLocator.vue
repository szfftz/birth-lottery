<!-- 這一國在世界的哪裡：整張世界地圖（等距圓柱，北緯 84°～南緯 58°）把這一國塗成獎項色、外面一圈會擴散的光環；
     full 模式右下角再放一張放大的小地圖（這一國跟鄰國的形狀）。
     地圖資料（src/data/world-svg.json，從 countries-50m.geojson 簡化）第一次用到才載入 -->
<template>
  <div v-if="shape" class="wl" :class="{ compact, 'like-map': fillOf }" :style="{ '--tier': color }">
    <svg class="wl-world" :viewBox="`0 0 360 ${H}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <!-- fillOf：跟大地圖一樣（同一面牆當背景、每一國塗自己的顏色、沒有國界線、後面一層陰影） -->
      <g v-if="fillOf" class="wl-lands"><path v-for="(f, k) in world" :key="k" :d="f.d" :fill="fillOf(k)" :stroke="fillOf(k)" /></g>
      <template v-else>
        <rect class="wl-sea" x="0" y="0" width="360" :height="H" />
        <path class="wl-land" :d="land" />
      </template>
      <path class="wl-hit" :d="shape.d" />
      <circle class="wl-ring" :cx="shape.c[0]" :cy="shape.c[1]" :r="ringR" />
      <circle class="wl-ring late" :cx="shape.c[0]" :cy="shape.c[1]" :r="ringR" />
      <circle class="wl-dot" :cx="shape.c[0]" :cy="shape.c[1]" :r="compact ? 3.2 : 2.4" />
    </svg>
    <div v-if="!compact" class="wl-zoom" :class="{ left: shape.c[0] > 190 }">
      <svg :viewBox="zoomBox" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect class="wl-sea" x="-360" y="-200" width="1080" height="600" />
        <path class="wl-land z" :d="land" />
        <path class="wl-hit z" :d="shape.d" />
      </svg>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { mainCenter, svgRings } from '../lib/center.js'

const props = defineProps({
  iso: { type: String, default: null },
  color: { type: String, default: '#f5c451' },
  compact: { type: Boolean, default: false },
  fillOf: { type: Function, default: null }, // 每一國塗什麼顏色（國碼 → 顏色）；有給就畫成跟大地圖一樣
})
const H = 142 // 84°N ～ 58°S

const world = ref(null)
import('../data/world-svg.json').then((m) => (world.value = m.default))

const land = computed(() => (world.value ? Object.values(world.value).map((f) => f.d).join('') : ''))
// 光環、圓點放在國家本土的中心（不是標籤點）
const shape = computed(() => {
  const f = world.value && props.iso ? world.value[props.iso] : null
  return f && { ...f, c: mainCenter(svgRings(f.d), f.c) }
})
// 光環：小國大一點，才看得到在哪
const ringR = computed(() => {
  if (!shape.value) return 6
  const [x0, y0, x1, y1] = shape.value.b
  const r = Math.max(x1 - x0 > 180 ? 30 : x1 - x0, y1 - y0) / 2 + 3
  return Math.min(Math.max(r, props.compact ? 9 : 7), 40)
})
// 放大圖的範圍：這一國的外框再往外留一點；跨國際換日線的（俄羅斯、斐濟）用標籤點附近
const zoomBox = computed(() => {
  let [x0, y0, x1, y1] = shape.value.b
  if (x1 - x0 > 180) { const cx = shape.value.c[0]; x0 = cx - 45; x1 = cx + 45 }
  const w = Math.max(x1 - x0, 6), h = Math.max(y1 - y0, 6)
  const size = Math.max(w, h * 1.3) * 1.35
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  return `${cx - size / 2} ${cy - size / 2.6} ${size} ${size / 1.3}`
})
</script>

<style scoped>
.wl { position: relative; border-radius: 14px; overflow: hidden; background: #0c1a3a; }
.wl-world { display: block; width: 100%; height: auto; }
.wl-sea { fill: #0c1a3a; }
.wl-land { fill: #3a4a78; stroke: #0c1a3a; stroke-width: 0.25; stroke-linejoin: round; }
.wl-hit { fill: var(--tier); stroke: #fff6cf; stroke-width: 0.6; stroke-linejoin: round; filter: drop-shadow(0 0 2px var(--tier)); }
.wl-dot { fill: #ffffff; stroke: var(--tier); stroke-width: 1.2; }
.wl-ring { fill: none; stroke: #ffe08a; stroke-width: 1.4; transform-box: fill-box; transform-origin: center; animation: wl-ping 2s ease-out infinite; }
.wl-ring.late { animation-delay: 1s; }
@keyframes wl-ping { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
.wl-zoom { position: absolute; right: 8px; bottom: 8px; width: 34%; aspect-ratio: 1.3; border-radius: 10px; overflow: hidden;
  border: 2px solid #f5c451; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.55); background: #0c1a3a; }
.wl-zoom.left { right: auto; left: 8px; } /* 國家在東半球：放大圖改放左下（美洲那邊），不要蓋到它 */
.wl-zoom svg { display: block; width: 100%; height: 100%; }
.wl-land.z { stroke-width: 0.15; }
.wl-hit.z { stroke-width: 0.25; filter: none; }
.compact { border-radius: 10px; border: 3px solid #f5c451; }
.compact .wl-land { fill: #4a5a8c; }
.wl.like-map { background: radial-gradient(120% 90% at 50% 45%, #7a1424 0%, #4a0b18 38%, #22060e 70%, #0c0306 100%); } /* 跟舞台的牆同一個深酒紅 */
.wl-lands { filter: drop-shadow(0 1.2px 1px rgba(0, 0, 0, 0.6)); }
.wl-lands path { stroke-width: 0.3; stroke-linejoin: round; }
.like-map .wl-hit { stroke: #ffffff; stroke-width: 0.9; filter: none; } /* 選到的國家：白線（跟大地圖一樣） */
.like-map .wl-ring { stroke: #ffffff; }
@media (prefers-reduced-motion: reduce) { .wl-ring { animation: none; opacity: 0.8; } }
</style>
