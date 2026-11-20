<template>
  <!-- 地圖面板（MapLibre）：國家照人類發展指數由低到高連續填色（不分級）；抽到的國家白框＋結果標籤；「抽過的」打開時畫投胎紀錄圓（面積＝抽中比例）
       沒有底圖：地圖是透明的，後面是跟搖獎機舞台同一面牆（.stage-wall） -->
  <div class="world-wrap">
    <div ref="el" class="world-map stage-wall"></div>
    <!-- 正下方的圖例：顏色＝人類發展指數，左邊最低、右邊最高 -->
    <div class="map-legend" :style="{ bottom: `${insetBottom + 12}px` }">
      <b>{{ hdiWord() }}</b>
      <span>{{ L('Low', '低', '低', '낮음') }} {{ HDI_RANGE[0].toFixed(2) }}</span>
      <i :style="{ background: HDI_RAMP }"></i>
      <span>{{ HDI_RANGE[1].toFixed(2) }} {{ L('High', '高', '高', '높음') }}</span>
    </div>
  </div>
</template>

<script setup>
import { mainCenter, geoRings } from '../lib/center.js'
import { L, lang } from '../i18n.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../lib/maplibre-worker.js'
import { addTooltip } from '../lib/tooltip.js'
import { fitScale } from '../lib/fit.js'
import bevelUrl from '../data/bevel-simple.geojson?url'
import worldUrl from '../data/countries-simple.geojson?url' // 簡化過的國界（scripts/simplify_world.mjs 從 countries-50m.geojson 做出來）
import { flagStyle, hdiColor, HDI_RANGE, HDI_RAMP, BALL_TOTAL, C, BALLS, hdiWord, rankText, tierIdx, nameOf, mapNameOf, prizeOf, colorOf, NODATA, TIERS, pTier, pIso, fmtP, oneIn, fmtBig, SHOW_PRIZE } from '../lottery.js'

const props = defineProps({
  insetBottom: { type: Number, default: 0 }, // 下面被擋住的高度（px，iPhone 的 Home 條）
  last: { type: String, default: null },
  counts: { type: Object, required: true },
  total: { type: Number, default: 0 },
  showTally: { type: Boolean, default: false }, // 抽過的圓：開關（預設關）
})

// 顏色、不透明度、線寬（px）
const BORDER = '#ffe2a0' // 國界、緯線：淡金色（跟舞台的金色菱格同一個金）
const BEVEL = 1 // 國家的立體感：亮邊、暗邊的粗細倍數（0＝沒有）
const SEL = '#ffffff' // 這次抽到的國家外框
const TALLY = { fill: '#2a0a14', line: '#ffe08a', glow: '#ffb340' } // 抽過的圓：深酒紅半透明面＋金邊＋暖金光暈
const OP = { fill: 1, line: 0.75, tally: 0.45 }
const W = { sel: 2.5, tally: 2 }
const R_FULL = 60 // 投胎紀錄圓：100% 時半徑幾 px
const rOf = (share) => R_FULL * Math.sqrt(share)
// 微型國家、小島國：在國家中心畫一顆圓點（顏色、金邊跟國家一樣）。兩種國家畫圓點：
//   1. 整個國家的陸地不到 MICRO_KM2（世界地圖上小到看不見）
//   2. 國土全部是比圓點還小的島（簡化國界時這些島已經不畫了，見 scripts/simplify_world.mjs）
// 大國的小島、外島不畫圓點。還畫得出陸地的微型國家，放大到陸地比圓點大了，圓點就收起來
const MICRO_KM2 = 4000, MICRO_R = 4
function microDots(world) {
  const out = []
  for (const f of world.features) {
    const iso = f.properties.adm0_a3, km2 = f.properties.km2, land = f.geometry.coordinates.length > 0
    if (!C[iso]?.on_map || !at[iso] || (land && km2 >= MICRO_KM2)) continue
    // z：放大到這一級，國家的直徑（當成圓）就跟圓點一樣大；沒有陸地可畫的一直顯示
    const kmPerPx0 = (40075 * Math.cos((at[iso][1] * Math.PI) / 180)) / 512
    const z = land ? Math.log2((MICRO_R * 2 * kmPerPx0) / (2 * Math.sqrt(km2 / Math.PI))) : 99
    out.push({ type: 'Feature', properties: { ...f.properties, c: hdiColor(iso), z }, geometry: { type: 'Point', coordinates: at[iso] } })
  }
  return { type: 'FeatureCollection', features: out }
}
const TALLY_LAYERS = ['tally-glow', 'tally', 'tally-dot']

// 緯線只畫特別的幾條：赤道（實線、最亮）、南北回歸線、南北極圈（虛線）；不畫經線
const TROPIC = 23.4366, POLAR = 66.5634
const GRATICULE = (() => {
  const f = [], pts = (a, b, k) => Array.from({ length: Math.round((b - a) / 2) + 1 }, (_, i) => k(a + i * 2))
  const par = (y, k) => f.push({ type: 'Feature', properties: { k }, geometry: { type: 'LineString', coordinates: pts(-180, 180, (x) => [x, y]) } })
  par(0, 'eq'); par(TROPIC, 'tropic'); par(-TROPIC, 'tropic'); par(POLAR, 'polar'); par(-POLAR, 'polar')
  return { type: 'FeatureCollection', features: f }
})()

// 一開始放大到「上下剛好塞滿」：北極圈到南美洲最南端（再留一點邊）剛好是畫面的高；左右比畫面寬，可以拖曳看；縮小可以看到整個世界（含兩極）
const SOUTH = -57
const TW_LON = 121 // 預設以台灣的經度為中心
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) // 墨卡托 y（弧度單位）
function fitBand() {
  const h = el.value.clientHeight - props.insetBottom - 16
  const span = mercY(POLAR) - mercY(SOUTH) // 一張世界地圖（512 px＠zoom 0）的高是 2π
  const zoom = Math.log2((h / span) * (2 * Math.PI) / 512)
  const lat = (Math.atan(Math.exp((mercY(POLAR) + mercY(SOUTH)) / 2)) * 360) / Math.PI - 90
  const minZoom = Math.log2(Math.min(h, el.value.clientWidth) / 512) // 整個世界（正方形）塞得進畫面
  return { zoom, lat, minZoom }
}

// 地圖跟這次抽到誰無關：不特別標出剛抽到的國家（白框、結果標籤都不顯示）。要加回來改成 true
const MARK_LAST = false
const lastIso = () => (MARK_LAST ? props.last ?? '' : '')
const el = ref(null)
let map, tag, home = null, at = {} // at：每一國本土的中心

// 重設：滑回一開始的位置、大小
function resetView() { if (map && home) map.easeTo({ ...home, duration: 500 }) }
defineExpose({ resetView })

function paint() {
  if (!map?.getLayer('prize')) return
  map.setFilter('prize-sel', ['==', ['get', 'adm0_a3'], lastIso()])
  map.setFilter('micro-sel', ['all', ['==', ['get', 'adm0_a3'], lastIso()], ['>', ['get', 'z'], ['zoom']]])
  const pts = Object.entries(props.counts).filter(([iso]) => at[iso]).map(([iso, n]) => ({
    type: 'Feature', properties: { iso, r: rOf(n / props.total), c: hdiColor(iso) }, geometry: { type: 'Point', coordinates: at[iso] },
  }))
  map.getSource('tally').setData({ type: 'FeatureCollection', features: pts.sort((a, b) => b.properties.r - a.properties.r) })
  for (const id of TALLY_LAYERS) map.setLayoutProperty(id, 'visibility', props.showTally ? 'visible' : 'none')
  paintTag()
}
// 結果標籤：放在這次抽到的國家中心
function paintTag() {
  const iso = lastIso()
  if (!iso || !at[iso]) { tag?.remove(); return }
  const box = tag?.getElement() ?? Object.assign(document.createElement('div'), { className: 'lottery-tag' })
  box.innerHTML = `<b>${nameOf(iso)}</b>${SHOW_PRIZE ? ` <span style="color:${colorOf(iso)}">${prizeOf(iso)}</span>` : ''}<br>${hdiWord()} ${C[iso].hdi?.toFixed(3) ?? '—'}${tierIdx(iso) < 0 ? '' : `<br>${SHOW_PRIZE ? `${L('Odds of this prize', '抽到此獎機率', 'この賞が当たる確率', '이 상에 당첨될 확률')} ${fmtP(pTier(TIERS[tierIdx(iso)]))} · ` : ''}${L('Odds of this country', '抽到此國機率', 'この国が当たる確率', '이 나라가 뽑힐 확률')} ${fmtP(pIso(iso))}`}`
  tag ??= new maplibregl.Marker({ element: box, anchor: 'bottom', offset: [0, -8] })
  tag.setLngLat(at[iso]).addTo(map)
}
// 點國家的說明：跟結果分頁的中獎票卡同一個排版、同一套樣式（.result-board.t-board：燈泡框、會轉的國旗球、斜體描邊國名、四格數字），縮成說明卡的大小。
// 四格的順序也一樣：人類發展指數、抽到此國機率、彩球、人口；抽中過的國家在國名上面多一行「抽中 N 次」
const tile = (label, value, note = '') => `<div class="tile"><span>${label}</span><b>${value}</b><small>${note || '&nbsp;'}</small></div>`
const TIP_NAME_CAP = 6 // 說明卡的國名放得下幾個全形字（24px）
function countryTip(f) {
  const iso = f.properties.adm0_a3, c = C[iso]
  if (!c) return `<p class="tc-note"><b>${mapNameOf(iso, f.properties.name_en ?? f.properties.name, f.properties.name_zh)}</b><br>${L('Not in the population list', '不在人口表裡', '人口リストにない地域', '인구 목록에 없음')}</p>`
  const t = TIERS[tierIdx(iso)], n = props.counts[iso], fs = flagStyle(iso), name = nameOf(iso)
  const face = `<i style="background-image:${fs.backgroundImage};background-size:${fs.backgroundSize};background-position:${fs.backgroundPosition}"></i>`
  const title = n ? `<div class="t-title">${L(`DRAWN ${n}×`, `抽中 ${n} 次`, `${n} 回当選`, `${n}번 뽑힘`)}</div>` : ''
  const about = (p) => L(`About 1 in ${oneIn(p)}`, `約 1/${oneIn(p)}`, `約 ${oneIn(p)} 分の 1`, `약 ${oneIn(p)}분의 1`)
  return `<article class="result-board t-board tc-board" style="--tier:${colorOf(iso)}"><div class="rb-bulbs"></div><div class="rb-shine"></div>`
    + `<div class="rb-body t-body"><div class="rb-ball"><div class="rb-flag"><div class="rb-roll">${face}${face}</div></div></div>`
    + `<div class="rb-main">${title}<div class="rb-name" style="--fit:${fitScale(name, TIP_NAME_CAP)}">${name}</div></div></div><div class="tiles">${[
      tile(hdiWord(), c.hdi == null ? '—' : c.hdi.toFixed(3), c.hdi == null ? L('No data', '沒有資料', 'データなし', '자료 없음') : c.hdi_rank ? rankText(iso) : ''),
      tile(L('Odds of this country', '抽到此國機率', 'この国が当たる確率', '이 나라가 뽑힐 확률'), t ? fmtP(pIso(iso)) : '—', t ? about(pIso(iso)) : L('Drawn again', '抽到再抽一次', '引き直し', '다시 뽑기')),
      ...(SHOW_PRIZE && t ? [tile(L('Prize', '獎項', '賞', '상'), prizeOf(iso), `${hdiWord()} ${t.range}`), tile(L('Odds of winning this prize', '抽到此獎機率', 'この賞が当たる確率', '이 상에 당첨될 확률'), fmtP(pTier(t)), about(pTier(t)))] : []),
      tile(L('Balls', '彩球', 'ボール', '공'), `${BALLS[iso] ?? 0}<em>${L('', '顆', '個', '개')}</em>`, L(`of ${BALL_TOTAL} balls`, `共 ${BALL_TOTAL} 顆`, `全 ${BALL_TOTAL} 個`, `총 ${BALL_TOTAL}개`)),
      tile(L('Population', '人口', '人口', '인구'), fmtBig(c.pop), c.pop_date),
    ].join('')}</div></article>`
}

onMounted(() => {
  const fit = fitBand()
  const z0 = fit.zoom
  home = { center: [TW_LON, fit.lat], zoom: z0 }
  map = new maplibregl.Map({
    container: el.value,
    center: home.center,
    zoom: z0,
    minZoom: Math.min(z0 - 1, fit.minZoom),
    attributionControl: false, // 不顯示資料來源（來源寫在「說明」裡）
    canvasContextAttributes: { antialias: true }, // 國界邊緣比較平滑
    style: { version: 8, sources: {}, layers: [] },
  })
  map.setPadding({ top: 0, bottom: props.insetBottom, left: 0, right: 0 })
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
  map.touchPitch.disable() // 兩指上下滑不要傾斜
  map.keyboard.disableRotation()
  map.on('load', async () => {
    const world = await (await fetch(worldUrl)).json()
    at = Object.fromEntries(world.features.map((f) => [f.properties.adm0_a3, mainCenter(geoRings(f.geometry), [f.properties.label_x, f.properties.label_y])]))
    map.addSource('countries', { type: 'geojson', data: world })
    map.addSource('bevel', { type: 'geojson', data: bevelUrl })
    map.addSource('micro', { type: 'geojson', data: microDots(world) })
    map.addSource('tally', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('graticule', { type: 'geojson', data: GRATICULE })
    const fillColor = ['match', ['get', 'adm0_a3'], ...Object.keys(C).filter((iso) => C[iso].on_map).flatMap((iso) => [iso, hdiColor(iso)]), NODATA]
    // 由下往上：緯線 → 陸地底下的影子（往下偏，有浮起來的感覺；背後只有影子，沒有金邊、光暈）→ 國家 → 兩國之間的國界（靠海不描邊）→ 微型國家的圓點 → 抽過的圓
    const zw = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], z0, a, z0 + 4, b]
    const lat = (id, k, width, opacity, dash) => map.addLayer({ id, type: 'line', source: 'graticule', filter: ['==', ['get', 'k'], k],
      paint: { 'line-color': BORDER, 'line-width': width, 'line-opacity': opacity, ...(dash ? { 'line-dasharray': dash } : {}) } })
    lat('grat-polar', 'polar', 0.9, 0.35, [5, 3])
    lat('grat-tropic', 'tropic', 0.9, 0.35, [2, 2.5])
    lat('grat-eq', 'eq', 1.2, 0.5, null) // 赤道：實線
    map.addLayer({ id: 'land-shadow', type: 'line', source: 'countries', layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#000000', 'line-width': zw(7, 18), 'line-blur': zw(7, 18), 'line-opacity': 0.55, 'line-translate': [0, 4] } })
    map.addLayer({ id: 'prize', type: 'fill', source: 'countries', paint: { 'fill-color': fillColor, 'fill-opacity': OP.fill, 'fill-antialias': true } })
    // 每一國一點立體感（浮雕）：每一國朝左上的邊畫一條亮線、朝右下的邊畫一條暗線，都往國家裡面縮一點（資料見 scripts/simplify_world.mjs），
    // 看起來像一塊微微鼓起來的牌子，光從左上來。線都在國家自己裡面，不會蓋到鄰國
    const bevel = (id, k, color, opacity) => map.addLayer({ id, type: 'line', source: 'bevel', filter: ['==', ['get', 'k'], k], layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': color, 'line-offset': zw(BEVEL * 1.3, BEVEL * 2.8), 'line-width': zw(BEVEL * 2.6, BEVEL * 5.6), 'line-blur': zw(BEVEL * 1.6, BEVEL * 3.4), 'line-opacity': opacity } })
    bevel('bevel-dark', 'dark', '#2a0018', 0.55)
    bevel('bevel-light', 'light', '#ffffff', 0.7)
    // 國界不另外畫線：靠每一國的浮雕邊（亮邊、暗邊）就分得開
    map.addLayer({ id: 'prize-sel', type: 'line', source: 'countries', filter: ['==', 'adm0_a3', ''], paint: { 'line-color': SEL, 'line-width': W.sel } })
    // 微型國家的圓點（在國家上面、抽過的圓下面）
    map.addLayer({ id: 'micro-glow', type: 'circle', source: 'micro', filter: ['>', ['get', 'z'], ['zoom']],
      paint: { 'circle-radius': MICRO_R + 5, 'circle-color': ['get', 'c'], 'circle-blur': 0.9, 'circle-opacity': 0.55 } })
    map.addLayer({ id: 'micro', type: 'circle', source: 'micro', filter: ['>', ['get', 'z'], ['zoom']],
      paint: { 'circle-radius': MICRO_R, 'circle-color': ['get', 'c'], 'circle-stroke-color': '#fff3d6', 'circle-stroke-width': 1.2 } })
    map.addLayer({ id: 'micro-sel', type: 'circle', source: 'micro', filter: ['==', 'adm0_a3', ''],
      paint: { 'circle-radius': MICRO_R + 1, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': SEL, 'circle-stroke-width': W.sel } })
    // 抽過的圓：金色霓虹圈（外面一圈暖光、半透明面、亮金色細邊），中間一顆獎項色的小點（白邊）＝國家的位置
    map.addLayer({ id: 'tally-glow', type: 'circle', source: 'tally',
      paint: { 'circle-radius': ['+', ['get', 'r'], 5], 'circle-color': TALLY.glow, 'circle-blur': 0.45, 'circle-opacity': 0.45 } })
    map.addLayer({ id: 'tally', type: 'circle', source: 'tally',
      paint: { 'circle-radius': ['get', 'r'], 'circle-color': TALLY.fill, 'circle-opacity': OP.tally, 'circle-stroke-color': TALLY.line, 'circle-stroke-width': W.tally } })
    map.addLayer({ id: 'tally-dot', type: 'circle', source: 'tally',
      paint: { 'circle-radius': 3.5, 'circle-color': ['get', 'c'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } })
    addTooltip(map, ['micro', 'prize'], countryTip, { hlBy: 'adm0_a3' })
    paint()
  })
})
watch(() => props.insetBottom, (b) => map?.setPadding({ top: 0, bottom: b, left: 0, right: 0 }))
watch(() => [props.last, props.total, props.showTally], paint)
watch(lang, paintTag) // 換語言：結果標籤重寫
onBeforeUnmount(() => { tag?.remove(); map?.remove() })
</script>

<style scoped>
.world-wrap, .world-map { position: absolute; inset: 0; }
.map-legend { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; padding: 7px 14px 5px; border-radius: 999px; white-space: nowrap; pointer-events: none;
  background: rgba(10, 5, 24, 0.82); border: 2px solid var(--gold); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45); color: #fff; font-size: 11px; font-weight: 700; line-height: 1; }
.map-legend b { font-weight: 800; }
.map-legend span { color: rgba(255, 255, 255, 0.8); font-variant-numeric: tabular-nums; }
.map-legend i { width: 96px; height: 10px; margin-top: -2px; border-radius: 999px; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
</style>

<style>
.lottery-tag { padding: 5px 9px; border-radius: 10px; background: rgba(10, 5, 24, 0.92); border: 2px solid #ffd6ec; box-shadow: 0 0 4px #ff2d95, 0 0 12px rgba(255, 45, 149, 0.6); color: #fff; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; pointer-events: none; }
.lottery-tag b { margin-right: 6px; font-size: 13px; }
.map-tooltip { pointer-events: none; }
.map-tooltip.pinned { pointer-events: auto; }
.map-tooltip .maplibregl-popup-content { padding: 0; background: none; box-shadow: none; border-radius: 18px;
  font-family: 'Overpass', 'Huninn', 'NanumSquareRoundB', 'Noto Sans TC', sans-serif; font-size: 12px; line-height: 1.3; color: #fff; }
/* 國家說明卡＝縮小的中獎票卡（樣式在 app.css 的 .result-board、.t-board、.tile），這裡只調大小 */
.result-board.tc-board { width: 252px; padding: 14px 12px 12px; border-width: 3px; box-shadow: 4px 4px 0 #2b0a5e, 0 0 0 2px #ff8a00, 0 10px 24px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(0, 0, 0, 0.35); }
.tc-board .t-body { gap: 10px; margin: 0 0 10px; padding: 0 2px; }
.tc-board .rb-ball { padding: 3px; }
.tc-board .rb-flag { width: 44px; height: 44px; }
.tc-board .rb-name { font-size: calc(24px * var(--fit, 1)); -webkit-text-stroke-width: calc(4px * var(--fit, 1)); text-shadow: 2px 2px 0 #2b0a5e; }
.tc-board .t-title { font-size: 10px; }
.tc-board .tiles { position: relative; gap: 6px; }
.tc-board .tile { padding: 7px 9px 6px; border-radius: 11px; }
.tc-board .tile > span { font-size: 10px; }
.tc-board .tile > b { font-size: 17px; }
.tc-board .tile > b em { font-size: 11px; }
.tc-board .tile > small { font-size: 10px; }
.tc-note { margin: 0; padding: 8px 12px; border-radius: 12px; background: rgba(10, 5, 24, 0.94); border: 2px solid #ffd6ec; font-size: 11px; color: rgba(255, 255, 255, 0.8); }
.map-tooltip .maplibregl-popup-tip { display: none; }
.map-tooltip [style*="color"], .lottery-tag [style*="color"] { filter: brightness(1.4); }
</style>
