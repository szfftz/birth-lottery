<template>
  <!-- 地圖面板（MapLibre）：國家照獎項填色；抽到的國家白框＋結果標籤；「抽過的」打開時畫投胎紀錄圓（面積＝抽中比例）
       沒有底圖：地圖是透明的，後面是跟搖獎機舞台同一面牆（.stage-wall） -->
  <div ref="el" class="world-map stage-wall"></div>
</template>

<script setup>
import { mainCenter, geoRings } from '../lib/center.js'
import { L, lang } from '../i18n.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../lib/maplibre-worker.js'
import { addTooltip } from '../lib/tooltip.js'
import worldUrl from '../data/countries-50m.geojson?url'
import { C, BALLS, hdiWord, rankText, tierIdx, nameOf, mapNameOf, prizeOf, colorOf, NODATA, TIERS, pTier, pIso, fmtP, oneIn, fmtBig, SHOW_PRIZE } from '../lottery.js'

const props = defineProps({
  insetBottom: { type: Number, default: 0 }, // 下面被擋住的高度（px，iPhone 的 Home 條）
  last: { type: String, default: null },
  counts: { type: Object, required: true },
  total: { type: Number, default: 0 },
  showTally: { type: Boolean, default: false }, // 抽過的圓：開關（預設關）
})

// 顏色、不透明度、線寬（px）
const BORDER = '#ffe2a0' // 國界、緯線：淡金色（跟舞台的金色菱格同一個金）
const SEL = '#ffffff' // 這次抽到的國家外框
const TALLY = { fill: '#2a0a14', line: '#ffe08a', glow: '#ffb340' } // 抽過的圓：深酒紅半透明面＋金邊＋暖金光暈
const OP = { fill: 1, line: 0.75, tally: 0.45 }
const W = { sel: 2.5, tally: 2 }
const R_FULL = 60 // 投胎紀錄圓：100% 時半徑幾 px
const rOf = (share) => R_FULL * Math.sqrt(share)
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

const el = ref(null)
let map, tag, home = null, at = {} // at：每一國本土的中心

// 重設：滑回一開始的位置、大小
function resetView() { if (map && home) map.easeTo({ ...home, duration: 500 }) }
defineExpose({ resetView })

function paint() {
  if (!map?.getLayer('prize')) return
  map.setFilter('prize-sel', ['==', ['get', 'adm0_a3'], props.last ?? ''])
  const pts = Object.entries(props.counts).filter(([iso]) => at[iso]).map(([iso, n]) => ({
    type: 'Feature', properties: { iso, r: rOf(n / props.total), c: colorOf(iso) }, geometry: { type: 'Point', coordinates: at[iso] },
  }))
  map.getSource('tally').setData({ type: 'FeatureCollection', features: pts.sort((a, b) => b.properties.r - a.properties.r) })
  for (const id of TALLY_LAYERS) map.setLayoutProperty(id, 'visibility', props.showTally ? 'visible' : 'none')
  paintTag()
}
// 結果標籤：放在這次抽到的國家中心
function paintTag() {
  const iso = props.last
  if (!iso || !at[iso]) { tag?.remove(); return }
  const box = tag?.getElement() ?? Object.assign(document.createElement('div'), { className: 'lottery-tag' })
  box.innerHTML = `<b>${nameOf(iso)}</b>${SHOW_PRIZE ? ` <span style="color:${colorOf(iso)}">${prizeOf(iso)}</span>` : ''}<br>${hdiWord()} ${C[iso].hdi?.toFixed(3) ?? '—'}${tierIdx(iso) < 0 ? '' : `<br>${SHOW_PRIZE ? `${L('Odds of this prize', '抽到此獎機率', 'この賞が当たる確率', '이 상에 당첨될 확률')} ${fmtP(pTier(TIERS[tierIdx(iso)]))} · ` : ''}${L('Odds of this country', '抽到此國機率', 'この国が当たる確率', '이 나라가 뽑힐 확률')} ${fmtP(pIso(iso))}`}`
  tag ??= new maplibregl.Marker({ element: box, anchor: 'bottom', offset: [0, -8] })
  tag.setLngLat(at[iso]).addTo(map)
}
// 點國家的說明
function countryTip(f) {
  const iso = f.properties.adm0_a3, c = C[iso]
  if (!c) return `<b>${mapNameOf(iso, f.properties.name_en ?? f.properties.name, f.properties.name_zh)}</b><br>${L('Not in the population list', '不在人口表裡', '人口リストにない地域', '인구 목록에 없음')}`
  const t = TIERS[tierIdx(iso)]
  return [
    `<b>${nameOf(iso)}</b>`,
    ...(!t ? [] : [
      ...(SHOW_PRIZE ? [L(`Odds of this prize <b>${fmtP(pTier(t))}</b> (about 1 in ${oneIn(pTier(t))})`, `抽到此獎機率 <b>${fmtP(pTier(t))}</b>（約 1/${oneIn(pTier(t))}）`, `この賞が当たる確率 <b>${fmtP(pTier(t))}</b>（約 ${oneIn(pTier(t))} 分の 1）`, `이 상에 당첨될 확률 <b>${fmtP(pTier(t))}</b> (약 ${oneIn(pTier(t))}분의 1)`)] : []),
      L(`Odds of this country <b>${fmtP(pIso(iso))}</b> (about 1 in ${oneIn(pIso(iso))})`, `抽到此國機率 <b>${fmtP(pIso(iso))}</b>（約 1/${oneIn(pIso(iso))}）`, `この国が当たる確率 <b>${fmtP(pIso(iso))}</b>（約 ${oneIn(pIso(iso))} 分の 1）`, `이 나라가 뽑힐 확률 <b>${fmtP(pIso(iso))}</b> (약 ${oneIn(pIso(iso))}분의 1)`)]),
    ...(BALLS[iso] ? [L(`${BALLS[iso]} ${BALLS[iso] > 1 ? 'balls' : 'ball'}`, `彩球 ${BALLS[iso]} 顆`, `ボール ${BALLS[iso]} 個`, `공 ${BALLS[iso]}개`)] : []),
    L(`Population ${fmtBig(c.pop)} (${c.pop_date})`, `人口 ${fmtBig(c.pop)}（${c.pop_date}）`, `人口 ${fmtBig(c.pop)}（${c.pop_date}）`, `인구 ${fmtBig(c.pop)} (${c.pop_date})`),
    c.hdi == null ? L('No HDI data', '沒有人類發展指數資料', 'HDI データなし', 'HDI 자료 없음') : `${hdiWord()} <b>${c.hdi.toFixed(3)}</b>${c.hdi_rank ? L(` (${rankText(iso)})`, `（${rankText(iso)}）`, `（${rankText(iso)}）`, ` (${rankText(iso)})`) : ''}${SHOW_PRIZE ? ` → ${prizeOf(iso)}` : ''}`,
    ...(props.counts[iso] ? [L(`Drawn ${props.counts[iso]} ${props.counts[iso] > 1 ? 'times' : 'time'}`, `抽中 ${props.counts[iso]} 次`, `${props.counts[iso]} 回当選`, `${props.counts[iso]}번 뽑힘`)] : []),
  ].join('<br>')
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
    map.addSource('tally', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('graticule', { type: 'geojson', data: GRATICULE })
    const fillColor = ['match', ['get', 'adm0_a3'], ...Object.keys(C).filter((iso) => C[iso].on_map).flatMap((iso) => [iso, colorOf(iso)]), NODATA]
    // 由下往上：緯線 → 陸地底下的影子（往下偏，有浮起來的感覺）→ 陸地外圍一圈金色光暈 → 國家 → 國界（放大時變粗一點）→ 抽到的白框 → 抽過的圓
    const zw = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], z0, a, z0 + 4, b]
    const lat = (id, k, width, opacity, dash) => map.addLayer({ id, type: 'line', source: 'graticule', filter: ['==', ['get', 'k'], k],
      paint: { 'line-color': BORDER, 'line-width': width, 'line-opacity': opacity, ...(dash ? { 'line-dasharray': dash } : {}) } })
    lat('grat-polar', 'polar', 0.9, 0.35, [5, 3])
    lat('grat-tropic', 'tropic', 0.9, 0.35, [2, 2.5])
    lat('grat-eq', 'eq', 1.2, 0.5, null) // 赤道：實線
    map.addLayer({ id: 'land-shadow', type: 'line', source: 'countries',
      paint: { 'line-color': '#000000', 'line-width': zw(7, 18), 'line-blur': zw(7, 18), 'line-opacity': 0.55, 'line-translate': [0, 4] } })
    map.addLayer({ id: 'land-glow', type: 'line', source: 'countries',
      paint: { 'line-color': '#ffcf70', 'line-width': zw(3.5, 9), 'line-blur': zw(3, 8), 'line-opacity': 0.4 } })
    map.addLayer({ id: 'prize', type: 'fill', source: 'countries', paint: { 'fill-color': fillColor, 'fill-opacity': OP.fill, 'fill-antialias': true } })
    map.addLayer({ id: 'prize-line', type: 'line', source: 'countries', layout: { 'line-join': 'round' }, paint: { 'line-color': BORDER, 'line-width': zw(0.45, 1.4), 'line-opacity': OP.line } })
    map.addLayer({ id: 'prize-sel', type: 'line', source: 'countries', filter: ['==', 'adm0_a3', ''], paint: { 'line-color': SEL, 'line-width': W.sel } })
    // 抽過的圓：金色霓虹圈（外面一圈暖光、半透明面、亮金色細邊），中間一顆獎項色的小點（白邊）＝國家的位置
    map.addLayer({ id: 'tally-glow', type: 'circle', source: 'tally',
      paint: { 'circle-radius': ['+', ['get', 'r'], 5], 'circle-color': TALLY.glow, 'circle-blur': 0.45, 'circle-opacity': 0.45 } })
    map.addLayer({ id: 'tally', type: 'circle', source: 'tally',
      paint: { 'circle-radius': ['get', 'r'], 'circle-color': TALLY.fill, 'circle-opacity': OP.tally, 'circle-stroke-color': TALLY.line, 'circle-stroke-width': W.tally } })
    map.addLayer({ id: 'tally-dot', type: 'circle', source: 'tally',
      paint: { 'circle-radius': 3.5, 'circle-color': ['get', 'c'], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } })
    addTooltip(map, ['prize'], countryTip)
    paint()
  })
})
watch(() => props.insetBottom, (b) => map?.setPadding({ top: 0, bottom: b, left: 0, right: 0 }))
watch(() => [props.last, props.total, props.showTally], paint)
watch(lang, paintTag) // 換語言：結果標籤重寫
onBeforeUnmount(() => { tag?.remove(); map?.remove() })
</script>

<style scoped>
.world-map { position: absolute; inset: 0; }
</style>

<style>
.lottery-tag { padding: 5px 9px; border-radius: 10px; background: rgba(10, 5, 24, 0.92); border: 2px solid #ffd6ec; box-shadow: 0 0 4px #ff2d95, 0 0 12px rgba(255, 45, 149, 0.6); color: #fff; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; pointer-events: none; }
.lottery-tag b { margin-right: 6px; font-size: 13px; }
.map-tooltip { pointer-events: none; }
.map-tooltip.pinned { pointer-events: auto; }
.map-tooltip .maplibregl-popup-content { padding: 8px 11px; border-radius: 12px; background: rgba(10, 5, 24, 0.94); color: #fff; border: 2px solid #ffd6ec;
  box-shadow: 0 0 4px #ff2d95, 0 0 14px rgba(255, 45, 149, 0.7), 0 6px 16px rgba(0, 0, 0, 0.5); font-size: 12px; line-height: 1.5; }
.map-tooltip .maplibregl-popup-tip { display: none; }
.map-tooltip [style*="color"], .lottery-tag [style*="color"] { filter: brightness(1.4); }
</style>
