// 滑鼠移到圖層上就顯示 tooltip，跟著游標走；手機沒有 hover，改成點一下顯示（固定住，裡面的連結點得到）
// 順手的關鍵：
//   1. tooltip 不吃滑鼠（style.css 的 .map-tooltip pointer-events: none）：不然 tooltip 跑到游標底下會擋住地圖，一直閃
//   2. 先找游標正下方，找不到再放寬到周圍 HIT_PX 像素：細線、小點不用對得很準
//   3. 一個畫格只查一次（requestAnimationFrame），內容沒變就只移位置、不重建 HTML
//   4. 滑到的物件描出來（面：黃色外框＋淡填色；線：黃色加粗；點：白色外圈），疊在所有圖層最上面
import * as maplibregl from 'maplibre-gl'

const HIT_PX = 5
const HL = '#ffe14d'
let hlCount = 0
const NO_HOVER = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches

/**
 * @param {maplibregl.Map} map
 * @param {string[] | (() => string[])} layers  依優先順序排列，重疊時只顯示第一個圖層的 tooltip；可以是函式（每次滑鼠移動時取目前的清單）
 * @param {(feature, event) => string} html  回傳 tooltip 內容（HTML）；event.lngLat 是滑鼠位置
 * @param {{ highlight?: boolean, hlBy?: string }} [opts]  highlight：滑到的物件要不要描亮（預設要；自己有 hover 樣式的頁可以關掉）
 *   hlBy：用這個屬性在原本的資料來源上描亮（例如國家代碼）。大的面會被圖磚切成好幾塊，照抄形狀來描會把圖磚的切邊也描出來（一條條直線）；有給 hlBy 就不會
 * @returns {(feature, lngLat) => void} 在指定位置顯示 tooltip（給物件列表用）
 */
export function addTooltip(map, layers, html, { highlight = true, hlBy = '' } = {}) {
  const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '280px', offset: 12, className: 'map-tooltip' })
  let lastHtml = ''
  let pinned = false // 點選（手機、物件列表）顯示的 tooltip 固定住，滑鼠移動不換掉
  let raf = 0, pending = null

  function pick(point) {
    const ids = (typeof layers === 'function' ? layers() : layers).filter((id) => map.getLayer(id))
    if (!ids.length) return null
    const byOrder = (fs) => fs.sort((a, b) => ids.indexOf(a.layer.id) - ids.indexOf(b.layer.id))[0]
    return byOrder(map.queryRenderedFeatures(point, { layers: ids }))
      ?? byOrder(map.queryRenderedFeatures([[point.x - HIT_PX, point.y - HIT_PX], [point.x + HIT_PX, point.y + HIT_PX]], { layers: ids }))
      ?? null
  }

  // ── 描亮滑到的物件 ──
  const hlId = `tooltip-hl-${++hlCount}`
  let hlKey = ''
  const EMPTY = { type: 'FeatureCollection', features: [] }
  function ensureHl() {
    if (map.getSource(hlId)) return true
    if (!map.isStyleLoaded()) return false
    map.addSource(hlId, { type: 'geojson', data: EMPTY })
    const is = (...t) => ['in', ['geometry-type'], ['literal', t]]
    const poly = is('Polygon', 'MultiPolygon'), line = is('LineString', 'MultiLineString'), pt = is('Point', 'MultiPoint')
    map.addLayer({ id: `${hlId}-fill`, type: 'fill', source: hlId, filter: poly, paint: { 'fill-color': HL, 'fill-opacity': 0.18 } })
    map.addLayer({ id: `${hlId}-line`, type: 'line', source: hlId, filter: ['any', poly, line], layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': HL, 'line-width': ['case', poly, 2.5, 4] } })
    map.addLayer({ id: `${hlId}-pt`, type: 'circle', source: hlId, filter: pt,
      paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 } }) // 點用白圈：很多天的點本身就是黃色
    return true
  }
  // 圖磚會把大的面、長的線切成好幾塊：把畫面上同一圖層、屬性完全一樣的幾塊都找出來一起描
  // hlBy：每個資料來源各放一組描亮圖層，用屬性篩出滑到的那一個（整個物件一起亮，沒有圖磚切邊）
  const groups = new Map()
  function setHlBy(f) {
    const NONE = ['==', ['get', hlBy], '\u0000']
    for (const ids of groups.values()) for (const id of ids) map.setFilter(id, NONE)
    const src = f?.layer?.source
    if (!src) return
    if (!groups.has(src)) {
      const pre = `${hlId}-${groups.size}`
      if (f.geometry.type.includes('Point')) {
        map.addLayer({ id: `${pre}-pt`, type: 'circle', source: src, filter: NONE, paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': HL, 'circle-stroke-width': 2.5 } })
        groups.set(src, [`${pre}-pt`])
      } else {
        map.addLayer({ id: `${pre}-fill`, type: 'fill', source: src, filter: NONE, paint: { 'fill-color': HL, 'fill-opacity': 0.18 } })
        map.addLayer({ id: `${pre}-line`, type: 'line', source: src, filter: NONE, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': HL, 'line-width': 2.5 } })
        groups.set(src, [`${pre}-fill`, `${pre}-line`])
      }
    }
    for (const id of groups.get(src)) { map.setFilter(id, ['==', ['get', hlBy], f.properties[hlBy] ?? '\u0000']); map.moveLayer(id) }
  }
  function setHl(f) {
    if (!highlight) return
    if (hlBy) {
      const k = f ? `${f.layer?.source}|${f.properties[hlBy]}` : ''
      if (k !== hlKey) { hlKey = k; setHlBy(f) }
      return
    }
    const key = f ? `${f.layer?.id ?? 'list'}|${f.id ?? ''}|${JSON.stringify(f.properties)}` : ''
    if (key === hlKey) return
    hlKey = key
    if (!ensureHl()) return
    let feats = []
    if (f?.geometry) {
      // 從物件列表來的（沒有 layer）：直接用它自己的形狀
      const parts = !f.layer || f.geometry.type.includes('Point') ? [f]
        : map.queryRenderedFeatures({ layers: [f.layer.id] }).filter((g) => (f.id != null ? g.id === f.id : JSON.stringify(g.properties) === JSON.stringify(f.properties)))
      feats = parts.map((g) => ({ type: 'Feature', properties: {}, geometry: g.geometry }))
    }
    map.getSource(hlId).setData({ type: 'FeatureCollection', features: feats })
    // 保持在最上面（各天之後加的圖層會蓋過去）
    for (const s of ['fill', 'line', 'pt']) if (map.getLayer(`${hlId}-${s}`)) map.moveLayer(`${hlId}-${s}`)
  }

  function show(f, e, pin) {
    setHl(f)
    const h = `<div class="quake-popup">${html(f, e)}</div>`
    if (h !== lastHtml) {
      popup.setHTML(h)
      lastHtml = h
    }
    popup.setLngLat(e.lngLat)
    if (!popup.isOpen()) popup.addTo(map)
    pinned = pin
    popup.getElement()?.classList.toggle('pinned', pin)
  }
  function hide() {
    setHl(null)
    popup.remove()
    lastHtml = ''
    pinned = false
  }

  function update(e, pin) {
    const f = pick(e.point)
    map.getCanvas().style.cursor = f ? 'pointer' : ''
    if (f) show(f, e, pin)
    else if (!pinned || pin) hide()
  }

  map.on('mousemove', (e) => {
    if (NO_HOVER) return
    pending = e
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0
      if (pinned) pinned = false // 滑鼠一動就回到跟著游標走
      update(pending, false)
    })
  })
  map.on('click', (e) => update(e, NO_HOVER))
  map.getCanvas().addEventListener('mouseleave', () => {
    if (!pinned) hide()
  })

  // 從物件列表點選時，直接在指定位置顯示同樣的 tooltip（固定住，等滑鼠回到地圖上再換）
  return (feature, lngLat) => show(feature, { lngLat }, true)
}
