<template>
  <!-- 盒子模式：891 顆彩球照格子模式的排法，一列一列放進透明壓克力收納盒（3D，蓋子打開）；球面是獎項顏色或國旗（國旗朝上），抽到的那顆浮起來放大 -->
  <!-- 手機：點一下球看是哪一國（拖曳不算點）；電腦：滑過去就看 -->
  <div ref="wrap" class="lottery-box" @pointerdown="onDown" @pointerup="onUp" @pointermove="onMove" @pointerleave="onLeave">
    <div v-if="tip" class="box-tip neon-tip" :style="tipPos" v-html="tip.html"></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { BALL_R as R, makeBallMesh, setBallFace, fitFov, lockSpin } from '../lib/ball3d.js'

const props = defineProps({
  // 舞台上下被狀態列、浮動操作列擋住的高度（px）：內容放在中間看得到的地方
  insetTop: { type: Number, default: 0 },
  insetBottom: { type: Number, default: 0 },
  // loadBalls() 的結果：isos、start（每國的球從第幾顆開始）、n
  balls: { type: Object, required: true },
  // 每顆球放在第幾格（格子模式的排法，含手動換過的）、格子幾欄幾列
  cells: { type: Object, required: true },
  cols: { type: Number, required: true },
  rows: { type: Number, required: true },
  // 每國球的顏色（獎項色）
  colors: { type: Object, required: true },
  // 國旗拼圖（ImageBitmap）、幾欄幾列
  atlas: { type: Object, default: null },
  grid: { type: Array, default: () => [1, 1] },
  face: { type: String, default: 'prize' }, // prize＝獎項色、flag＝國旗
  sel: { type: Number, default: null }, // 抽到的是第幾顆
  tipOf: { type: Function, required: true }, // 第 b 顆球的 tooltip（HTML）
  bg: { type: String, default: '#ffffff' },
  frames: { type: Array, default: () => [] }, // 色框：[{ color, from, to }]＝第 from～to 格（含）框一圈這個顏色（盒子・照獎：每一獎一個顏色）
  walls: { type: Array, default: () => [] }, // 隔板：[[欄, 列], [欄, 列]] 一段一段（格線上、水平或垂直）；盒子・照獎用來把每一獎隔開
})

// 收納盒（場景單位：球的直徑＝1）：像樂透球的透明壓克力收納盒，球一列一列排好、沒有隔板，蓋子打開立在後面
// x＝欄（往右）、z＝列（往前）；一格 PITCH 見方
const PITCH = 1.04
const CASE = { pad: 0.35, t: 0.12, rim: 0.9, base: 0.15, lidOpen: 105 } // 球和邊的空隙、壓克力厚、框高、底板厚、蓋子打開幾度
const ACRYLIC = '#dfeaf0'
const METAL = '#c9ccd1'
const EDGE = '#9aa4ab' // 壓克力的邊（白底上要看得到）
// 鏡頭的仰角（從正前方往下看幾度）：國旗朝上，要從上面看；看的中心往後移一點，打開的蓋子也放得進畫面
const TILT = THREE.MathUtils.degToRad(72)
// 球往前轉幾度：國旗那面朝「前上方 45°」
const FACE_TILT = THREE.MathUtils.degToRad(45)
const CAM_DIST = 4.1 // 鏡頭離盒子中心幾倍盒子深度：整個盒子（含打開的蓋子）放得進畫面

const wrap = ref(null)
const tip = ref(null)
let renderer, scene, camera, controls, mesh, ro, raf = 0

const W = () => props.cols * PITCH, D = () => props.rows * PITCH
// 第 k 格的中心
const cellX = (k) => ((k % props.cols) + 0.5) * PITCH - W() / 2
const cellZ = (k) => (Math.floor(k / props.cols) + 0.5) * PITCH - D() / 2

// 一個壓克力盒（底＋四邊，開口朝上）：半透明板子＋灰色細邊，看得出是壓克力
function tray(w, d, rim, mat, edge, baseMat = mat) {
  const g = new THREE.Group()
  const { t, base } = CASE
  const add = (sx, sy, sz, x, y, z, mm = mat) => {
    const geo = new THREE.BoxGeometry(sx, sy, sz)
    const m = new THREE.Mesh(geo, mm); m.position.set(x, y, z); if (mm.transparent) m.renderOrder = 2; else m.receiveShadow = m.castShadow = true; g.add(m)
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); e.position.copy(m.position); g.add(e)
  }
  add(w + 2 * t, base, d + 2 * t, 0, -base / 2, 0, baseMat)
  for (const sz of [-1, 1]) add(w + 2 * t, rim, t, 0, rim / 2, sz * (d / 2 + t / 2))
  for (const sx of [-1, 1]) add(t, rim, d, sx * (w / 2 + t / 2), rim / 2, 0)
  return g
}

// 收納盒：透明壓克力底盒、打開的蓋子（後面的邊當鉸鏈，往後翻開 CASE.lidOpen 度）、前面的金屬提把和兩個扣環
function makeBox() {
  const g = new THREE.Group()
  // 底盒不透明（底、四邊），才有影子；蓋子另外用透明壓克力
  const mat = new THREE.MeshStandardMaterial({ color: '#f3f4f5', roughness: 0.5, metalness: 0, side: THREE.DoubleSide })
  const edge = new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.8 })
  const metal = new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.25, metalness: 0.9 })
  const { pad, t, rim } = CASE
  const w = W() + 2 * pad, d = D() + 2 * pad
  g.add(tray(w, d, rim, mat, edge))
  // 隔板：沿著格線、跟框一樣高的壓克力片（貼到盒子邊的那段延伸到框）
  const gx = (c) => (c <= 0 ? -w / 2 : c >= props.cols ? w / 2 : c * PITCH - W() / 2)
  const gz = (r) => (r <= 0 ? -d / 2 : r >= props.rows ? d / 2 : r * PITCH - D() / 2)
  for (const [[c0, r0], [c1, r1]] of props.walls) {
    const x0 = gx(c0), x1 = gx(c1), z0 = gz(r0), z1 = gz(r1)
    const geo = new THREE.BoxGeometry(Math.abs(x1 - x0) + t, rim, Math.abs(z1 - z0) + t)
    const m = new THREE.Mesh(geo, mat); m.position.set((x0 + x1) / 2, rim / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; g.add(m)
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); e.position.copy(m.position); g.add(e)
  }
  // 蓋子：跟底盒一樣大、淺一點，開口朝下蓋上去；鉸鏈在後面的上緣
  // 蓋子：透明壓克力（底盒不透明）
  const lidMat = new THREE.MeshPhysicalMaterial({ color: ACRYLIC, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide })
  const lid = tray(w, d, rim * 0.6, lidMat, edge)
  lid.rotation.x = Math.PI // 開口朝下
  const hinge = new THREE.Group()
  hinge.position.set(0, rim, -d / 2 - t)
  lid.position.set(0, 0, d / 2 + t) // 蓋子的後緣對齊鉸鏈
  hinge.add(lid)
  hinge.rotation.x = -THREE.MathUtils.degToRad(CASE.lidOpen) // 從蓋好（0°）往後翻開幾度（90°＝直立）
  g.add(hinge)
  // 鉸鏈：後緣兩段金屬圓管
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 16), metal)
    h.rotation.z = Math.PI / 2; h.position.set(sx * w * 0.3, rim, -d / 2 - t); g.add(h)
  }
  // 提把：前面中間一條彎的金屬管
  const curve = new THREE.CatmullRomCurve3([[-2.4, 0], [-2.2, 0.9], [0, 1.1], [2.2, 0.9], [2.4, 0]].map(([x, z]) => new THREE.Vector3(x, rim * 0.5, d / 2 + t + z)))
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.13, 12), metal))
  // 扣環：前面左右兩個小金屬片
  for (const sx of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, rim * 0.7, 0.12), metal)
    c.position.set(sx * w * 0.32, rim * 0.5, d / 2 + t + 0.08); g.add(c)
  }
  return g
}

// 色框：第 from～to 格（一列一列連續的一段）外圍往內縮一點描一圈，放在球頂上方，從上面看得到
const FRAME = { inset: 0.12, w: 0.22, y: 1.06 }
function rangePolys(from, to) {
  const C = props.cols, r0 = Math.floor(from / C), c0 = from % C, r1 = Math.floor(to / C), c1 = (to % C) + 1
  if (r0 === r1) return [[[c0, r0], [c1, r0], [c1, r0 + 1], [c0, r0 + 1]]]
  if (r1 === r0 + 1 && c1 <= c0) return [[[c0, r0], [C, r0], [C, r0 + 1], [c0, r0 + 1]], [[0, r1], [c1, r1], [c1, r1 + 1], [0, r1 + 1]]]
  const p = [[c0, r0], [C, r0], [C, r1], [c1, r1], [c1, r1 + 1], [0, r1 + 1], [0, r0 + 1], [c0, r0 + 1]]
  // 去掉重複點、一直線上的點
  const q = p.filter((v, i) => { const a = p[(i + p.length - 1) % p.length]; return !(v[0] === a[0] && v[1] === a[1]) })
  return [q.filter((v, i) => { const a = q[(i + q.length - 1) % q.length], b = q[(i + 1) % q.length]; return !((a[0] === v[0] && v[0] === b[0]) || (a[1] === v[1] && v[1] === b[1])) })]
}
function makeFrames() {
  const g = new THREE.Group()
  for (const { color, from, to } of props.frames) {
    // 淡色系（index.vue 給的每一獎一個淡色）：底＝淡色、壁＝淡色半透明、框線＝淡色再深一點；不吃色調映射，顏色才不會變灰
    const base = new THREE.Color(color)
    const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(0.78), toneMapped: false })
    const floorMat = new THREE.MeshBasicMaterial({ color: base, toneMapped: false })
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 }) // 淡色底上面再鋪一層只顯示影子的
    for (const poly of rangePolys(from, to)) {
      const n = poly.length
      // 底：這一獎的格子鋪淡色
      const shape = new THREE.Shape(poly.map(([c, r]) => new THREE.Vector2(c * PITCH - W() / 2, r * PITCH - D() / 2)))
      const fl = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2), floorMat)
      fl.position.y = 0.005; g.add(fl)
      const sh = new THREE.Mesh(fl.geometry, shadowMat); sh.position.y = 0.01; sh.receiveShadow = true; g.add(sh)
      let area = 0
      for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1] }
      const sg = area > 0 ? 1 : -1
      // 每條邊往內的法向量（直角多邊形：頂點往兩條邊的法向量加起來的方向移）
      const nrm = poly.map((a, i) => { const b = poly[(i + 1) % n], dx = Math.sign(b[0] - a[0]), dz = Math.sign(b[1] - a[1]); return [-dz * sg, dx * sg] })
      const pts = poly.map((v, i) => { const m1 = nrm[(i + n - 1) % n], m2 = nrm[i]; return [v[0] * PITCH - W() / 2 + FRAME.inset * (m1[0] + m2[0]), v[1] * PITCH - D() / 2 + FRAME.inset * (m1[1] + m2[1])] })
      // 邊：沿著這一獎的外圍立一圈淡色的壁（貼著隔板內側，跟盒框一樣高）
      const wallMat = new THREE.MeshBasicMaterial({ color: base, side: THREE.DoubleSide, toneMapped: false })
      const wp = poly.map((v, i) => { const m1 = nrm[(i + n - 1) % n], m2 = nrm[i], e = 0.02; return [v[0] * PITCH - W() / 2 + e * (m1[0] + m2[0]), v[1] * PITCH - D() / 2 + e * (m1[1] + m2[1])] })
      for (let i = 0; i < n; i++) {
        const a = wp[i], b = wp[(i + 1) % n], len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const m = new THREE.Mesh(new THREE.PlaneGeometry(len, CASE.rim), wallMat)
        m.position.set((a[0] + b[0]) / 2, CASE.rim / 2, (a[1] + b[1]) / 2)
        m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); g.add(m)
      }
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n]
        const m = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(b[0] - a[0]) + FRAME.w, FRAME.w, Math.abs(b[1] - a[1]) + FRAME.w), mat)
        m.position.set((a[0] + b[0]) / 2, FRAME.y, (a[1] + b[1]) / 2); g.add(m)
      }
    }
  }
  return g
}

// 每顆球放在自己那一格（球心比底板高一點，坐在格子裡）；抽到的那顆浮起來、放大
const dummy = new THREE.Object3D()
function place() {
  const { n } = props.balls
  for (let b = 0; b < n; b++) {
    const k = props.cells[b], up = b === props.sel
    dummy.position.set(cellX(k), up ? R * 2.2 + 1.5 : R, cellZ(k))
    dummy.scale.setScalar(up ? 2.2 : 1)
    dummy.rotation.set(FACE_TILT, 0, 0) // 國旗那面朝前上方 45°
    dummy.updateMatrix()
    mesh.setMatrixAt(b, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}
// 球的說明：滑鼠滑過去；手機點一下（拖曳不算）、3 秒後收起來
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
let down = null, tipTimer = 0
function pickAt(e) {
  const r = wrap.value.getBoundingClientRect()
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObject(mesh)[0]
  tip.value = hit ? { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height, html: props.tipOf(hit.instanceId) } : null
}
function onMove(e) {
  if (e.pointerType === 'mouse' && !e.buttons) pickAt(e)
  else if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) tip.value = null
}
function onDown(e) { down = { x: e.clientX, y: e.clientY } }
function onUp(e) {
  if (e.pointerType !== 'mouse' && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= 6) {
    pickAt(e)
    clearTimeout(tipTimer)
    tipTimer = setTimeout(() => (tip.value = null), 3000)
  }
  down = null
}
function onLeave(e) { if (e.pointerType === 'mouse') tip.value = null }
// 說明框不要超出畫面：靠右、靠下時翻到手指的另一邊
const tipPos = computed(() => {
  const t = tip.value, right = t.x > t.w * 0.55, below = t.y < t.h * 0.6
  return { [right ? 'right' : 'left']: `${right ? t.w - t.x + 12 : t.x + 12}px`, [below ? 'top' : 'bottom']: `${below ? t.y + 12 : t.h - t.y + 12}px` }
})

function resize() {
  const w = wrap.value.clientWidth, h = wrap.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.fov = fitFov(22, camera.aspect) // 畫面比 4:5 長：視角放大，盒子不會被左右切掉
  camera.setViewOffset(w, h, 0, (props.insetBottom - props.insetTop) / 2, w, h) // 放在上下沒被擋住的中間
  camera.updateProjectionMatrix()
}
function frame() {
  raf = requestAnimationFrame(frame)
  controls.update()
  renderer.render(scene, camera)
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(props.bg)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  wrap.value.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  const sun = new THREE.DirectionalLight('#ffffff', 1.2)
  sun.position.set(-8, 20, 12)
  // 影子：正交陰影相機蓋住整個盒子
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches ? 2048 : 4096) // 手機影子貼圖小一點
  const sc = sun.shadow.camera, half = Math.max(W(), D()) * 0.8
  sc.left = sc.bottom = -half; sc.right = sc.top = half; sc.near = 1; sc.far = 80
  sun.shadow.bias = -0.0005; sun.shadow.radius = 3
  scene.add(sun)
  scene.add(makeBox())
  scene.add(makeFrames())
  mesh = makeBallMesh({ balls: props.balls, colors: props.colors, atlas: props.atlas, grid: props.grid, face: props.face })
  mesh.castShadow = true
  scene.add(mesh)
  place()
  camera = new THREE.PerspectiveCamera(22, 1, 0.1, 500) // 視角窄一點，近大遠小不要太誇張
  // 從正前方斜上看整個盒子
  camera.position.set(0, D() * CAM_DIST * Math.sin(TILT), D() * CAM_DIST * Math.cos(TILT) - D() * 0.32)
  // 鏡頭固定在預設視角，只能縮放（滾輪、兩指）：不能轉、不能平移
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, -D() * 0.32)
  lockSpin(controls)
  { const d = camera.position.distanceTo(controls.target); controls.minDistance = d * 0.25; controls.maxDistance = d * 1.6 }
  ro = new ResizeObserver(resize)
  ro.observe(wrap.value)
  resize()
  frame()
})
watch(() => [props.sel, props.cells], () => mesh && place())
watch(() => [props.insetTop, props.insetBottom], () => renderer && resize())
watch(() => props.face, () => mesh && setBallFace(mesh, props.face))
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  clearTimeout(tipTimer)
  ro?.disconnect()
  controls?.dispose()
  scene?.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.() })
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<style scoped>
.lottery-box { position: absolute; inset: 0; z-index: 2; overflow: hidden; touch-action: none; }
.lottery-box :deep(canvas) { display: block; }
.box-tip { position: absolute; pointer-events: none; z-index: 5; max-width: min(240px, 70%); }
</style>
