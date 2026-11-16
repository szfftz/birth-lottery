<template>
  <!-- 地圖、彩球、排列、格子模式（MapLibre）：從 Day 25 index.vue 搬過來
       地圖：國家照獎項填色，抽過的國家畫投胎紀錄圓（面積＝抽中比例）
       彩球：每國的球排成一塊放在本土中心；排列：照獎項從左上排到右下；格子：照各國相對位置排（點兩顆球交換） -->
  <div ref="el" class="map-modes" :style="{ '--it': `${insetTop}px`, '--ib': `${insetBottom}px` }"></div>
</template>

<script setup>
import { L, lang } from '../i18n.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import '../lib/maplibre-worker.js'
import { addTooltip } from '../lib/tooltip.js'
import { glBalls, createBallLayer } from '../lib/ballLayer.js'
import worldUrl from '../data/countries-50m.geojson?url'
import {
  C, BALLS, balls as ballInfo, colors, flagMeta, cellMeta, cellOf, cellsSnap, gridOrder, BOX_PASTEL,
  mode, onBoard, tierIdx, nameOf, prizeOf, colorOf, NODATA, TIERS, pTier, pIso, fmtP, oneIn, fmtBig, ballTip,
} from '../lottery.js'

const props = defineProps({
  // 舞台上下被狀態列、浮動操作列擋住的高度（px）：內容放在中間看得到的地方
  insetTop: { type: Number, default: 0 },
  insetBottom: { type: Number, default: 0 },
  face: { type: String, default: 'flag' },
  last: { type: String, default: null },
  lastBall: { type: Number, default: null },
  counts: { type: Object, required: true },
  total: { type: Number, default: 0 },
  atlas: { type: Object, default: null },
})

// 地圖、圖例共用：國界、這次抽到的外框、投胎紀錄圓的顏色，不透明度，線寬（px）
const FLAT_BG = '#0d0926' // 跟盒子、主畫面同一個深靛藍
const BORDER = '#ffffff'
const SEL = '#ffffff'
const TALLY = { fill: '#ffffff', line: '#ffffff' }
const OP = { fill: 0.85, line: 0.6, tally: 0.3, ballDim: 0.35 }
const BALL_SEL = 28 // 抽到的那顆放大成幾 px
const GRID_FILL = 0.8 // 排列、格子模式：球的直徑＝格子的幾成
const BALL_GAP = 1.15 // 彩球模式：球心距＝直徑的幾倍
const W = { line: 0.4, sel: 2.5, tally: 1.2 }
const R_FULL = 60 // 投胎紀錄圓：100% 時半徑幾 px
const rOf = (share) => R_FULL * Math.sqrt(share)
const FLAG_SCALE = 1.5 // 球面畫國旗時，彩球模式的球放大幾倍
// 框（1080×1350 的單位）四邊留白：上、左右 40，下 80（跟 Day 25 的 IG 框紅線一樣）
const GUIDE = { head: 14, side: 12, foot: 84 } // px：上面、左右、下面（下面留給結果卡）

// 一開始的縮放：手機寬度不一樣，讓世界寬度約是畫面寬的 1.84 倍（Day 25 在 IG 框裡 1.2 級的樣子）
let z0 = 1.2
// 球的直徑（css px）：一開始 8 px，放大跟著變大，最大 24 px
const ballSize = (z) => Math.min(24, Math.max(8, 8 * 2 ** ((z - z0) * 0.8)))
const curSize = (z) => (onBoard() ? gridD : props.face === 'flag' ? ballSize(z) * FLAG_SCALE : ballSize(z))

const el = ref(null)
let map, tag, balls, ballLayer, at = {}, layLngLat = null, gridD = 0, cellBg = null

// 框裡的範圍（畫面 px）
// 排列、格子模式的框：扣掉上面狀態列、下面操作列和結果卡的位置
function boardRect() {
  const c = map.getContainer(), w = c.clientWidth, h = c.clientHeight
  const top = props.insetTop + GUIDE.head, bottom = props.insetBottom + GUIDE.foot
  return { x0: GUIDE.side, y0: top, w: w - 2 * GUIDE.side, h: h - top - bottom }
}
// 彩球模式：每國的球排成一塊，中心放在那一國本土的中心（Natural Earth 標籤點），一列一列左右置中、整塊上下置中
function clusterXY() {
  const step = curSize(map.getZoom()) * BALL_GAP
  const xy = new Float32Array(balls.n * 2)
  balls.isos.forEach((iso, k) => {
    const n = balls.start[k + 1] - balls.start[k]
    const c = map.project(at[iso])
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols)
    for (let j = 0; j < n; j++) {
      const r = Math.floor(j / cols), inRow = Math.min(cols, n - r * cols)
      const b = balls.start[k] + j
      xy[b * 2] = c.x + ((j % cols) - (inRow - 1) / 2) * step
      xy[b * 2 + 1] = c.y + (r - (rows - 1) / 2) * step
    }
  })
  return xy
}
// 排列模式：照獎項（特獎→哈哈獎→重抽）、同一級裡 HDI 高到低，從框的左上一列一列排到右下
function gridXY() {
  const { x0, y0, w, h } = boardRect()
  const n = balls.n, c0 = Math.round(Math.sqrt((n * w) / h))
  let cols = c0, cell = 0
  for (let c = Math.max(1, c0 - 3); c <= c0 + 3; c++) {
    const z = Math.min(w / c, h / Math.ceil(n / c))
    if (z > cell) { cell = z; cols = c }
  }
  const ox = x0 + (w - cols * cell) / 2
  const xy = new Float32Array(n * 2)
  gridOrder.forEach((b, k) => {
    xy[b * 2] = ox + ((k % cols) + 0.5) * cell
    xy[b * 2 + 1] = y0 + (Math.floor(k / cols) + 0.5) * cell
  })
  gridD = cell * GRID_FILL
  return xy
}
// 格子模式：build_cells.py 算好每顆球放第幾格（一格一顆、照各國相對位置），格子排在框裡置中；每一格的底照獎項鋪淡色
function cellsXY() {
  const { x0, y0, w, h } = boardRect()
  const { cols, rows } = cellMeta
  const cell = Math.min(w / cols, h / rows)
  const ox = x0 + (w - cols * cell) / 2, oy = y0 + (h - rows * cell) / 2
  const xy = new Float32Array(balls.n * 2)
  const px = (x, y) => { const ll = map.unproject([x, y]); return [ll.lng, ll.lat] }
  const features = []
  for (let b = 0; b < balls.n; b++) {
    const cx = ox + (cellOf[b] % cols) * cell, cy = oy + Math.floor(cellOf[b] / cols) * cell
    xy[b * 2] = cx + cell / 2
    xy[b * 2 + 1] = cy + cell / 2
    features.push({ type: 'Feature', properties: { c: BOX_PASTEL.at(tierIdx(balls.isos[kOf(b)])) },
      geometry: { type: 'Polygon', coordinates: [[px(cx, cy), px(cx + cell, cy), px(cx + cell, cy + cell), px(cx, cy + cell), px(cx, cy)]] } })
  }
  gridD = cell * GRID_FILL
  cellBg = { type: 'FeatureCollection', features }
  return xy
}
const kOf = (b) => { let lo = 0, hi = balls.isos.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; balls.start[m] <= b ? (lo = m) : (hi = m - 1) } return lo }
const ballAt = (b) => [layLngLat[b * 2], layLngLat[b * 2 + 1]]

// 球的位置都是畫面上的點，地圖一移動就重排（換回墨卡托座標給球圖層）
function layoutBalls() {
  if (!map || mode.value === 'map' || !balls || !Object.keys(at).length) return
  const xy = mode.value === 'grid' ? gridXY() : mode.value === 'cells' ? cellsXY() : clusterXY()
  const pos = new Float32Array(balls.n * 2)
  layLngLat = new Float32Array(balls.n * 2)
  for (let b = 0; b < balls.n; b++) {
    const ll = map.unproject([xy[b * 2], xy[b * 2 + 1]])
    const m = maplibregl.MercatorCoordinate.fromLngLat(ll)
    pos[b * 2] = m.x; pos[b * 2 + 1] = m.y
    layLngLat[b * 2] = ll.lng; layLngLat[b * 2 + 1] = ll.lat
  }
  ballLayer.setPos(pos)
  map.getSource('cell-bg')?.setData(mode.value === 'cells' && cellBg ? cellBg : { type: 'FeatureCollection', features: [] })
  paintBallSel()
  paintHit()
}
// 每顆球的 tooltip 位置（彩球類模式；地圖模式清空）
function paintHit() {
  const on = mode.value !== 'map' && balls && layLngLat
  const feats = !on ? [] : Array.from({ length: balls.n }, (_, b) => ({ type: 'Feature', properties: { b }, geometry: { type: 'Point', coordinates: ballAt(b) } }))
  map.getSource('ball-hit')?.setData({ type: 'FeatureCollection', features: feats })
  if (on) map.setPaintProperty('ball-hit', 'circle-radius', curSize(map.getZoom()) / 2)
}
// 格子模式換位置：第一顆點的球（黃色圈）
function paintBallSel() {
  const on = props.lastBall != null && mode.value !== 'map' && layLngLat
  map.getSource('ball-sel').setData({ type: 'FeatureCollection', features: !on ? [] : [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ballAt(props.lastBall) } }] })
  paintTag()
}
function paint() {
  if (!map?.getLayer('prize')) return
  map.setFilter('prize-sel', ['==', ['get', 'adm0_a3'], props.last ?? ''])
  ballLayer?.setSel(mode.value === 'map' ? null : props.lastBall)
  paintBallSel()
  const pts = Object.entries(props.counts).filter(([iso]) => at[iso]).map(([iso, n]) => ({
    type: 'Feature', properties: { iso, r: rOf(n / props.total) }, geometry: { type: 'Point', coordinates: at[iso] },
  }))
  map.getSource('tally').setData({ type: 'FeatureCollection', features: pts.sort((a, b) => b.properties.r - a.properties.r) })
}
// 結果標籤：放在這次抽到的國家標籤點上，彩球類模式放在抽到的球上
function paintTag() {
  const iso = props.last
  const onBall = props.lastBall != null && mode.value !== 'map' && layLngLat
  if (!iso || !at[iso] || (mode.value !== 'map' && !onBall && onBoard())) { tag?.remove(); return }
  const el = tag?.getElement() ?? Object.assign(document.createElement('div'), { className: 'lottery-tag' })
  el.innerHTML = `<b>${nameOf(iso)}</b> <span style="color:${colorOf(iso)}">${prizeOf(iso)}</span><br>HDI ${C[iso].hdi?.toFixed(3) ?? '—'}${tierIdx(iso) < 0 ? '' : `<br>${L('Prize odds', '這一獎機率')} ${fmtP(pTier(TIERS[tierIdx(iso)]))} · ${L('Country odds', '這一國機率')} ${fmtP(pIso(iso))}`}`
  tag ??= new maplibregl.Marker({ element: el, anchor: 'bottom' })
  tag.setOffset([0, onBall ? -(BALL_SEL / 2 + 8) : -8])
  tag.setLngLat(onBall ? ballAt(props.lastBall) : at[iso]).addTo(map)
}

// 切模式：彩球模式關掉國土填色和投胎紀錄圓，只留國界；排列、格子模式蓋一層純色底
function applyMode() {
  if (!map?.getLayer('prize')) return
  const m = mode.value
  const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  vis('balls', m !== 'map')
  vis('grid-bg', onBoard())
  vis('cell-bg', m === 'cells')
  vis('prize-sel', !onBoard())
  vis('prize', m === 'map')
  vis('tally', m === 'map')
  ballLayer?.setFlags(props.face === 'flag')
  if (m !== 'map') layoutBalls()
  else { layLngLat = null; paintHit() }
  paint()
}

onMounted(() => {
  const w = el.value.clientWidth
  z0 = Math.log2((1.84 * w) / 512)
  map = new maplibregl.Map({
    container: el.value,
    center: [15, 20],
    zoom: z0,
    minZoom: z0 - 1,
    attributionControl: { compact: true },
    // Esri 深灰底圖（跟 Day 25 一樣）
    style: {
      version: 8,
      sources: { base: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 16, attribution: '© Esri' } },
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': FLAT_BG } }, { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 0.4 } }],
    },
  })
  map.setPadding({ top: props.insetTop, bottom: props.insetBottom, left: 0, right: 0 })
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()
  map.touchPitch.disable() // 兩指上下滑不要傾斜
  map.keyboard.disableRotation()
  map.on('load', async () => {
    const world = await (await fetch(worldUrl)).json()
    at = Object.fromEntries(world.features.map((f) => [f.properties.adm0_a3, [f.properties.label_x, f.properties.label_y]]))
    map.addSource('countries', {
      type: 'geojson', data: world,
      attribution: 'HDI, population: <a href="https://en.wikipedia.org/" target="_blank">Wikipedia</a>; <a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>',
    })
    map.addSource('tally', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('ball-sel', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    const fillColor = ['match', ['get', 'adm0_a3'], ...Object.keys(C).filter((iso) => C[iso].on_map).flatMap((iso) => [iso, colorOf(iso)]), NODATA]
    map.addLayer({ id: 'prize', type: 'fill', source: 'countries', paint: { 'fill-color': fillColor, 'fill-opacity': OP.fill } })
    map.addLayer({ id: 'prize-line', type: 'line', source: 'countries', paint: { 'line-color': BORDER, 'line-width': W.line, 'line-opacity': OP.line } })
    map.addLayer({ id: 'prize-sel', type: 'line', source: 'countries', filter: ['==', 'adm0_a3', ''], paint: { 'line-color': SEL, 'line-width': W.sel } })
    map.addLayer({ id: 'tally', type: 'circle', source: 'tally',
      paint: { 'circle-radius': ['get', 'r'], 'circle-color': TALLY.fill, 'circle-opacity': OP.tally, 'circle-stroke-color': TALLY.line, 'circle-stroke-width': W.tally } })
    map.addLayer({ id: 'ball-sel', type: 'circle', source: 'ball-sel', paint: { 'circle-radius': BALL_SEL / 2 + 2, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': SEL, 'circle-stroke-width': W.sel } })
    map.addLayer({ id: 'grid-bg', type: 'background', layout: { visibility: 'none' }, paint: { 'background-color': FLAT_BG } }, 'prize-sel')
    map.addSource('cell-bg', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'cell-bg', type: 'fill', source: 'cell-bg', paint: { 'fill-color': ['get', 'c'], 'fill-antialias': false } }, 'prize-sel')
    map.addSource('ball-hit', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addLayer({ id: 'ball-hit', type: 'circle', source: 'ball-hit', paint: { 'circle-radius': 4, 'circle-opacity': 0 } })
    // 彩球：GL 點圖層
    balls = glBalls(ballInfo, colors)
    ballLayer = createBallLayer(balls, { size: curSize, selSize: BALL_SEL, dim: OP.ballDim, atlas: props.atlas, grid: [flagMeta.cols, flagMeta.rows] })
    map.addLayer(ballLayer, 'prize-sel')
    map.on('move', layoutBalls)
    map.on('resize', layoutBalls)
    addTooltip(map, ['ball-hit'], (f) => ballTip(f.properties.b))
    addTooltip(map, ['prize'], (f) => {
      const iso = f.properties.adm0_a3, c = C[iso]
      if (!c) return L(`<b>${f.properties.name_en ?? f.properties.name}</b><br>Not in the population list`, `<b>${f.properties.name_zh ?? f.properties.name}</b><br>不在人口表裡`)
      return [
        `<b>${nameOf(iso)}</b>`,
        ...(tierIdx(iso) < 0 ? [] : [
          L(`Odds of this prize <b>${fmtP(pTier(TIERS[tierIdx(iso)]))}</b> (about 1 in ${oneIn(pTier(TIERS[tierIdx(iso)]))})`, `抽到這一獎的機率 <b>${fmtP(pTier(TIERS[tierIdx(iso)]))}</b>（約 1/${oneIn(pTier(TIERS[tierIdx(iso)]))}）`),
          L(`Odds of this country <b>${fmtP(pIso(iso))}</b> (about 1 in ${oneIn(pIso(iso))})`, `抽到這一國的機率 <b>${fmtP(pIso(iso))}</b>（約 1/${oneIn(pIso(iso))}）`)]),
        ...(BALLS[iso] ? [L(`${BALLS[iso]} ${BALLS[iso] > 1 ? 'balls' : 'ball'}`, `彩球 ${BALLS[iso]} 顆`)] : []),
        L(`Population ${fmtBig(c.pop)} (${c.pop_date})`, `人口 ${fmtBig(c.pop)}（${c.pop_date}）`),
        c.hdi == null ? L('No HDI data', '沒有 HDI 資料') : `HDI <b>${c.hdi.toFixed(3)}</b>${c.hdi_rank ? L(` (UNDP rank #${c.hdi_rank})`, `（UNDP 第 ${c.hdi_rank} 名）`) : ''} → ${prizeOf(iso)}`,
        ...(props.counts[iso] ? [L(`Drawn ${props.counts[iso]} ${props.counts[iso] > 1 ? 'times' : 'time'}`, `抽中 ${props.counts[iso]} 次`)] : []),
      ].join('<br>')
    })
    applyMode()
  })
})
watch(mode, applyMode)
watch(() => [props.insetTop, props.insetBottom], () => { map?.setPadding({ top: props.insetTop, bottom: props.insetBottom, left: 0, right: 0 }); layoutBalls() })
watch(() => [props.last, props.lastBall, props.total], paint)
watch(() => props.face, (f) => { ballLayer?.setFlags(f === 'flag'); layoutBalls() })
watch(cellsSnap, layoutBalls)
watch(lang, () => paintTag()) // 換語言：結果標籤重寫
onBeforeUnmount(() => { tag?.remove(); map?.remove() })
</script>

<style scoped>
.map-modes { position: absolute; inset: 0; background: #0d0926; }
</style>

<style>
/* 地圖的版權、控制項放在操作列上面、狀態列下面 */
.map-modes .maplibregl-ctrl-bottom-right, .map-modes .maplibregl-ctrl-bottom-left { bottom: var(--ib, 0px); }
.map-modes .maplibregl-ctrl-top-right, .map-modes .maplibregl-ctrl-top-left { top: var(--it, 0px); }
.map-modes .maplibregl-ctrl-attrib.maplibregl-compact { background: rgba(10, 5, 24, 0.75); color: rgba(255, 255, 255, 0.7); }
.map-modes .maplibregl-ctrl-attrib a { color: rgba(255, 255, 255, 0.8); }
.lottery-tag { padding: 5px 9px; border-radius: 10px; background: rgba(10, 5, 24, 0.92); border: 2px solid #ffd6ec; box-shadow: 0 0 4px #ff2d95, 0 0 12px rgba(255, 45, 149, 0.6); color: #fff; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; pointer-events: none; }
.lottery-tag b { margin-right: 6px; font-size: 13px; }
.map-tooltip { pointer-events: none; }
.map-tooltip.pinned { pointer-events: auto; }
.map-tooltip .maplibregl-popup-content { padding: 8px 11px; border-radius: 12px; background: rgba(10, 5, 24, 0.94); color: #fff; border: 2px solid #ffd6ec;
  box-shadow: 0 0 4px #ff2d95, 0 0 14px rgba(255, 45, 149, 0.7), 0 6px 16px rgba(0, 0, 0, 0.5); font-size: 12px; line-height: 1.5; }
.map-tooltip .maplibregl-popup-tip { display: none; }
.map-tooltip [style*="color"], .lottery-tag [style*="color"] { filter: brightness(1.4); }
</style>
