<template>
  <!-- 遊戲模式：891 顆彩球放進透明的樂透搖獎機（3D 圓滾筒）。按「抽一次」滾筒轉起來，筒裡的擋板把球帶上去再翻下來；
       停下來後滾筒慢慢轉到出球口朝下、打開閘門，哪一顆球靠重力掉出去就是抽到的，沿著滑道滾進前面的盤子（全部照物理模擬） -->
  <!-- 整個舞台蓋滿外層 App.vue 的 .stage-wrap（手機整個畫面）：舞台背景（CSS）→ 3D 搖獎機（透明畫布）→ 節目標題、結果看板（slot）、彩帶；
       文字類用寬 1080（4:5 時 1080×1350）設計再縮放，畫面比 4:5 長時設計稿跟著變長：標題貼上面、按鈕貼下面，多出來的空間給搖獎機 -->
  <div ref="wrap" class="lottery-drum">
    <div class="stage" :style="{ left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px`, '--itp': `${insetTop}px`, '--ibp': `${insetBottom}px` }">
      <!-- 舞台背景：賭場——深酒紅牆（菱格壁紙）、中間一圈暖光、兩道聚光燈、飄著的光點（散景）、地上一圈反光 -->
      <div class="stage-bg stage-wall">
        <div class="glow"></div>
        <div class="beam l"></div><div class="beam r"></div>
        <div class="bokeh"><i v-for="b in BOKEH" :key="b.k" :style="b.style"></i></div>
        <!-- 賭場：飄著的撲克牌花色 -->
        <div class="suits"><i v-for="c in SUITS" :key="c.k" :style="c.style">{{ c.ch }}</i></div>
        <div class="floor"></div>
        <div class="vignette"></div>
      </div>
      <!-- 手機：點一下球看是哪一國（拖曳不算點）；電腦：滑過去就看 -->
      <div ref="glBox" class="stage-gl" @pointerdown="onDown" @pointerup="onUp" @pointermove="onMove" @pointerleave="onLeave"></div>
      <!-- 探照燈：四盞彩色探照燈一直在舞台上亂掃；搖獎時掃得更快 -->
      <div class="spots" :class="{ fast: spinning }"><i v-for="k in 4" :key="k" :class="`sp${k}`"></i></div>
      <div class="stage-ui" :style="uiStyle">
        <!-- 整個舞台外圈的跑馬燈：搖獎時快速轉、中獎後慢慢轉 -->
        <div v-if="spinning || sel != null" class="marquee" :class="{ fast: spinning }"><i class="mt"></i><i class="mr"></i><i class="mb"></i><i class="ml"></i></div>
        <!-- 節目標題：賭場霓虹看板（黑底板、粉紅＋青色兩圈霓虹燈管框），BIRTH 粉紅、LOTTERY 青色霓虹字，偶爾閃一下；數字那行也在看板裡 -->
        <div ref="titleEl" class="show-title">
          <NeonSign :balls="balls.n" :countries="balls.isos.length" />
        </div>
        <div class="show-board"><slot /></div>
        <div v-if="pieces.length" :key="party" class="confetti">
          <i v-for="(c, i) in pieces" :key="i" :style="c"></i>
        </div>
      </div>
      <div v-if="tip" class="drum-tip neon-tip" :style="tipPos" v-html="tip.html"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import NeonSign from './NeonSign.vue'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { BALL_R as R, LOW, makeBallMesh, setBallFace, fitFov, lockSpin } from '../lib/ball3d.js'
import { DRUM, BASE, SUB, SPIN, FINS, HOLE, CHUTE, TRAY, wrapA, createDrumSim } from '../lib/drumPhysics.js'

const props = defineProps({
  // 舞台上下被狀態列、浮動操作列擋住的高度（px）：內容放在中間看得到的地方
  insetTop: { type: Number, default: 0 },
  insetBottom: { type: Number, default: 0 },
  balls: { type: Object, required: true }, // loadBalls() 的結果
  colors: { type: Object, required: true }, // 每國球的顏色（獎項色）
  atlas: { type: Object, default: null }, // 國旗拼圖
  grid: { type: Array, default: () => [1, 1] },
  face: { type: String, default: 'prize' }, // prize＝獎項色、flag＝國旗
  sel: { type: Number, default: null }, // 打開時盤子裡要放哪一顆（上一次抽到的）
  tipOf: { type: Function, required: true }, // 第 b 顆球的 tooltip（HTML）
  bg: { type: String, default: '#ffffff' },
  party: { type: Number, default: 0 }, // 換一個數字（每次公布結果）就灑一次彩帶
  spinning: { type: Boolean, default: false }, // 搖獎中（跑馬燈轉快）
  paused: { type: Boolean, default: false }, // 被地圖／彩球盒面板蓋住：先不算、不畫（手機才不會卡）
})
const ACRYLIC = '#e8f4ff'
const CAM = { az: 28, el: 22, dist: 100 } // 預設鏡頭：方位（往右幾度）、仰角、距離

const wrap = ref(null), glBox = ref(null)
const box = reactive({ x: 0, y: 0, w: 0, h: 0 }) // 舞台的範圍（整個元件）
const tip = ref(null)
// 背景的散景光點：位置、大小、顏色、閃爍節奏用固定的亂數（每次看起來一樣）
// 撲克牌花色、籌碼：一樣用固定亂數排
const SUITS = (() => {
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  return Array.from({ length: 8 }, (_, k) => ({ k, ch: '♠♥♦♣'[k % 4], style: {
    left: `${8 + rnd() * 84}%`, top: `${14 + rnd() * 50}%`, fontSize: `${40 + rnd() * 26}px`, color: k % 4 === 1 || k % 4 === 2 ? '#ff4f6d' : '#f5c451',
    animationDelay: `${-rnd() * 10}s`, animationDuration: `${8 + rnd() * 8}s`, opacity: 0.3 + rnd() * 0.25, '--r': `${(rnd() - 0.5) * 60}deg` } }))
})()
const BOKEH = (() => {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const cols = ['#ffd27a', '#ff7a8a', '#ffe9b0', '#ffffff']
  return Array.from({ length: 26 }, (_, k) => {
    const d = 6 + rnd() * 26
    return { k, style: { left: `${rnd() * 100}%`, top: `${rnd() * 62}%`, width: `${d}px`, height: `${d}px`, background: cols[k % cols.length],
      animationDelay: `${-rnd() * 6}s`, animationDuration: `${4 + rnd() * 5}s`, opacity: 0.25 + rnd() * 0.45 } }
  })
})()
// 設計稿縮放：寬 1080、高 1350 都要塞得下；多出來的那一邊把設計稿拉長
const uiStyle = computed(() => {
  const s = Math.min(box.w / 1080, box.h / 1350) || 1
  return { width: `${box.w / s}px`, height: `${box.h / s}px`, transform: `scale(${s})`, '--fall': `${box.h / s + 70}px`,
    '--it': `${props.insetTop / s}px`, '--ib': `${props.insetBottom / s}px`,
    // 招牌：畫面越矮（橫的、短的）縮越小，留空間給搖獎機
    '--ss': Math.min(1, Math.max(0.55, ((box.h - props.insetTop - props.insetBottom) / box.w - 0.5) / 0.9)) }
})
// 說明框不要超出舞台：靠右、靠下時翻到手指的另一邊
const tipPos = computed(() => {
  const t = tip.value, right = t.x > box.w * 0.55, below = t.y < box.h * 0.6
  return { [right ? 'right' : 'left']: `${right ? box.w - t.x + 12 : t.x + 12}px`, [below ? 'top' : 'bottom']: `${below ? t.y + 12 : box.h - t.y + 12}px` }
})
let renderer, scene, camera, controls, mesh, rot, gate, ro, raf = 0
let turntable // 搖獎機＋彩球整組（靜止時小小左右轉）

// ── 球的模擬：lib/drumPhysics.js ──
const n = props.balls.n
const sim = createDrumSim(n)
const { px, py, pz, ox, oy, oz, where, rand, step, initBalls, putBack, placeInTray } = sim

// ── 3D 場景：開獎節目的舞台 ──
// 圓形兩層的展示台（深紅＋金，邊上一圈跑馬燈）、後面鍍鉻的 A 字支架、鍍鉻的滾筒框、滾筒外面一圈燈泡、會反光的舞台地板
const PED = { r1: 15.5, r2: 14.2, h1: 0.9, floor: -1.7 } // 下層半徑、上層半徑、下層高、地板高（上層頂面＝BASE.h）
let bulbs = [] // 跑馬燈：{ mesh, n, speed }
function bulbRing(parent, n, radius, y, z, axisZ, size) {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), n)
  const d = new THREE.Object3D()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    if (axisZ) d.position.set(Math.cos(a) * radius, y + Math.sin(a) * radius, z) // 立著的圈（滾筒前面）
    else d.position.set(Math.cos(a) * radius, y, z + Math.sin(a) * radius) // 平躺的圈（展示台邊）
    d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, new THREE.Color('#fff3b0'))
  }
  parent.add(m)
  bulbs.push({ mesh: m, n })
  return m
}
// 燈泡追逐：每 4 顆亮 2 顆、往前跑；搖獎時跑快一點
const BULB_ON = new THREE.Color('#fff1a8').multiplyScalar(1.6), BULB_OFF = new THREE.Color('#5a3a10')
function animateBulbs(t, fast) {
  const k = Math.floor(t * (fast ? 22 : 7))
  for (const { mesh: m, n } of bulbs) {
    for (let i = 0; i < n; i++) m.setColorAt(i, (i + k) % 4 < 2 ? BULB_ON : BULB_OFF)
    m.instanceColor.needsUpdate = true
  }
}
// 地板：深色、會反光，邊緣慢慢透明（接到 CSS 的舞台背景）
// 程式畫的雜訊貼圖（當粗糙度／凹凸用）：brushed＝橫向細刮痕（貼在圓柱上就是一圈一圈的髮絲紋）；flake＝細小亮片
const noiseCache = {}
function noiseTexture(kind) {
  if (noiseCache[kind]) return noiseCache[kind]
  const W = 512, H = kind === 'brushed' ? 128 : 512
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  if (kind === 'brushed') {
    for (let y = 0; y < H; y++) {
      const row = 170 + rnd() * 40 // 每一條刮痕亮度不一樣
      for (let i = 0; i < W; i++) { const v = row + (rnd() - 0.5) * 30; const o = (y * W + i) * 4; d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255 }
    }
  } else {
    for (let i = 0; i < W * H; i++) { const v = rnd() < 0.08 ? 40 + rnd() * 60 : 200 + rnd() * 55; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255 }
  }
  x.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (kind === 'brushed') t.repeat.set(1, 6); else t.repeat.set(4, 4)
  t.anisotropy = 8
  return (noiseCache[kind] = t)
}
function fadeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const x = c.getContext('2d'), gr = x.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#ffffff'); gr.addColorStop(1, '#000000')
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
function makeMachine() {
  const g = new THREE.Group()
  // 材質（照真的東西調）：
  //  壓克力：折射率 1.49、很亮的反光、幾乎透明；鍍鉻：髮絲紋（一圈一圈的細刮痕）、很亮；
  //  金：真金的顏色（偏橘的黃）、拉絲、有一點霧；展示台：汽車烤漆——底下金屬亮片、上面一層很亮的透明漆
  const brushed = noiseTexture('brushed'), flake = noiseTexture('flake')
  const acrylic = new THREE.MeshPhysicalMaterial({ color: ACRYLIC, roughness: 0.03, metalness: 0, ior: 1.49, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.2 })
  const chrome = new THREE.MeshPhysicalMaterial({ color: '#f3f5f8', metalness: 1, roughness: 0.14, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.2, envMapIntensity: 1.4 })
  const gold = new THREE.MeshPhysicalMaterial({ color: '#f2b84a', metalness: 1, roughness: 0.3, roughnessMap: brushed, envMapIntensity: 1.3 })
  const redLac = new THREE.MeshPhysicalMaterial({ color: '#8e0f1f', metalness: 0.6, roughness: 0.5, roughnessMap: flake, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 })
  const add = (parent, geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = !mat.transparent && !mat.isMeshBasicMaterial; parent.add(m); return m }
  // 地板
  const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 96), new THREE.MeshPhysicalMaterial({ color: '#0e4a2c', roughness: 0.9, metalness: 0, sheen: 0.8, sheenColor: '#3fae6e', sheenRoughness: 0.6, transparent: true, alphaMap: fadeTexture() }))
  floor.rotation.x = -Math.PI / 2; floor.position.y = PED.floor; floor.receiveShadow = true
  g.add(floor)
  // 展示台：下層賭場紅烤漆（邊上一圈燈泡）、上層金色（頂面＝BASE.h）、中間一條金邊
  add(g, new THREE.CylinderGeometry(PED.r1, PED.r1 + 0.4, PED.h1, 96), redLac, 0, PED.floor + PED.h1 / 2, 0)
  bulbRing(g, 36, PED.r1 + 0.05, PED.floor + PED.h1 / 2, 0, false, 0.34)
  const h2 = BASE.h - (PED.floor + PED.h1)
  add(g, new THREE.CylinderGeometry(PED.r2, PED.r2, h2, 96), gold, 0, BASE.h - h2 / 2, 0)
  add(g, new THREE.TorusGeometry(PED.r2, 0.12, 12, 96), chrome, 0, BASE.h, 0).rotation.x = Math.PI / 2
  // 支架：滾筒後面一個鍍鉻 A 字架，兩隻腳從展示台撐到軸心
  const zb = -DRUM.d / 2 - 1.1
  for (const sx of [-1, 1]) {
    const from = new THREE.Vector3(sx * 6.5, BASE.h, zb), to = new THREE.Vector3(0, DRUM.y, zb)
    const leg = add(g, new THREE.CylinderGeometry(0.45, 0.55, from.distanceTo(to), 24), chrome, (from.x + to.x) / 2, (from.y + to.y) / 2, zb)
    leg.rotation.z = Math.atan2(-(to.x - from.x), to.y - from.y) // 圓柱本來是直的（+y），轉到腳的方向
    add(g, new THREE.CylinderGeometry(0.9, 1.1, 0.4, 24), gold, from.x, BASE.h + 0.2, zb) // 腳座
  }
  const axle = add(g, new THREE.CylinderGeometry(0.35, 0.35, DRUM.d + 2.6, 24), chrome, 0, DRUM.y, -0.6)
  axle.rotation.x = Math.PI / 2
  add(g, new THREE.SphereGeometry(1.1, 24, 16), gold, 0, DRUM.y, zb) // 軸心的金球
  // 滾筒：透明圓筒＋前後兩片透明圓板、鍍鉻的粗框；前面再一圈燈泡
  const rim = add(g, new THREE.CylinderGeometry(DRUM.r + 0.1, DRUM.r + 0.1, DRUM.d, 128, 1, true), acrylic, 0, DRUM.y, 0)
  rim.rotation.x = Math.PI / 2
  for (const sz of [-1, 1]) {
    add(g, new THREE.CircleGeometry(DRUM.r + 0.1, 128), acrylic, 0, DRUM.y, sz * DRUM.d / 2)
    add(g, new THREE.TorusGeometry(DRUM.r + 0.25, 0.32, 16, 128), chrome, 0, DRUM.y, sz * DRUM.d / 2)
  }
  bulbRing(g, 40, DRUM.r + 1.05, DRUM.y, DRUM.d / 2 + 0.1, true, 0.3)
  add(g, new THREE.TorusGeometry(DRUM.r + 1.05, 0.08, 8, 128), gold, 0, DRUM.y, DRUM.d / 2 + 0.05) // 燈泡底下的金圈
  // 跟著滾筒轉的：前面的鍍鉻輻條、金色中心蓋、裡面的擋板、出球口的框和閘門
  rot = new THREE.Group()
  rot.position.set(0, DRUM.y, 0)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const sp = add(rot, new THREE.CylinderGeometry(0.12, 0.12, DRUM.r, 12), chrome, Math.cos(a) * DRUM.r / 2, Math.sin(a) * DRUM.r / 2, DRUM.d / 2 + 0.2)
    sp.rotation.z = a - Math.PI / 2
  }
  const hub = add(rot, new THREE.CylinderGeometry(1.3, 1.3, 0.5, 48), gold, 0, 0, DRUM.d / 2 + 0.25)
  hub.rotation.x = Math.PI / 2
  add(rot, new THREE.SphereGeometry(0.7, 24, 16), chrome, 0, 0, DRUM.d / 2 + 0.55)
  for (let f = 0; f < FINS.n; f++) {
    const a = FINS.a0 + (f / FINS.n) * Math.PI * 2, mid = DRUM.r - FINS.len / 2
    const fin = add(rot, new THREE.BoxGeometry(FINS.len, FINS.t, DRUM.d), acrylic, Math.cos(a) * mid, Math.sin(a) * mid, 0)
    fin.rotation.z = a
  }
  const hole = new THREE.Group()
  hole.rotation.z = HOLE.a
  for (const sd of [-1, 1]) {
    add(hole, new THREE.BoxGeometry(0.2, HOLE.w + 0.4, 0.2), gold, DRUM.r + 0.2, 0, DRUM.d / 2 - HOLE.d / 2 + sd * HOLE.d / 2)
    add(hole, new THREE.BoxGeometry(0.2, 0.2, HOLE.d), gold, DRUM.r + 0.2, sd * (HOLE.w / 2 + 0.1), DRUM.d / 2 - HOLE.d / 2)
  }
  gate = add(hole, new THREE.BoxGeometry(0.08, HOLE.w, HOLE.d), chrome, DRUM.r + 0.25, 0, DRUM.d / 2 - HOLE.d / 2)
  rot.add(hole)
  g.add(rot)
  // 滑道：透明底、兩條鍍鉻欄杆
  const len = Math.hypot(CHUTE.z1 - CHUTE.z0 + 1, CHUTE.y0 - CHUTE.y1), slope = Math.atan2(CHUTE.y0 - CHUTE.y1, CHUTE.z1 - CHUTE.z0 + 1)
  const chute = new THREE.Group()
  chute.position.set(0, (CHUTE.y0 + CHUTE.y1) / 2 - R, (CHUTE.z0 - 1 + CHUTE.z1) / 2)
  chute.rotation.x = slope
  add(chute, new THREE.BoxGeometry(CHUTE.w, 0.08, len), acrylic, 0, 0, 0)
  for (const sd of [-1, 1]) { const r = add(chute, new THREE.CylinderGeometry(0.07, 0.07, len, 8), chrome, sd * CHUTE.w / 2, 0.5, 0); r.rotation.x = Math.PI / 2 }
  g.add(chute)
  add(g, new THREE.CylinderGeometry(0.15, 0.15, CHUTE.y0 - R - BASE.h, 12), chrome, 0, (CHUTE.y0 - R + BASE.h) / 2, CHUTE.z0 - 1)
  // 接球盒：跟滾筒一樣是透明壓克力（厚一點、比較看得到），四邊的稜角是鍍鉻細框、上緣一圈會亮的燈條，跟金色台面分得開
  const T = 0.22, Hh = 1.1, y0 = BASE.h
  const box = new THREE.MeshPhysicalMaterial({ color: '#dff1ff', roughness: 0.04, metalness: 0, ior: 1.49, clearcoat: 1, clearcoatRoughness: 0.02,
    transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 2.4 })
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd76a').multiplyScalar(1.6), toneMapped: false })
  const ow = TRAY.w + T * 2, od = TRAY.d + T * 2
  add(g, new THREE.BoxGeometry(ow, 0.14, od), box, 0, y0 + 0.07, TRAY.z) // 底
  for (const sd of [-1, 1]) {
    add(g, new THREE.BoxGeometry(ow, Hh, T), box, 0, y0 + Hh / 2, TRAY.z + sd * (TRAY.d / 2 + T / 2))
    add(g, new THREE.BoxGeometry(T, Hh, TRAY.d), box, sd * (TRAY.w / 2 + T / 2), y0 + Hh / 2, TRAY.z)
    // 上緣燈條
    add(g, new THREE.BoxGeometry(ow, 0.09, 0.12), glow, 0, y0 + Hh, TRAY.z + sd * od / 2)
    add(g, new THREE.BoxGeometry(0.12, 0.09, od), glow, sd * ow / 2, y0 + Hh, TRAY.z)
    // 底下的鍍鉻框
    add(g, new THREE.BoxGeometry(ow + 0.1, 0.12, 0.12), chrome, 0, y0 + 0.06, TRAY.z + sd * od / 2)
    add(g, new THREE.BoxGeometry(0.12, 0.12, od + 0.1), chrome, sd * ow / 2, y0 + 0.06, TRAY.z)
    // 四個角的鍍鉻立柱
    for (const sx of [-1, 1]) add(g, new THREE.CylinderGeometry(0.08, 0.08, Hh, 10), chrome, sx * ow / 2, y0 + Hh / 2, TRAY.z + sd * od / 2)
  }
  return g
}

// ── 畫球：每顆球有自己的方向，照移動的距離滾動（像在下面的東西上滾：轉軸＝上方 × 移動方向、轉的角度＝距離 ÷ 半徑）──
const dummy = new THREE.Object3D()
const quat = new Float32Array(n * 4) // 每顆球的方向（四元數）
const lx = new Float32Array(n), ly = new Float32Array(n), lz = new Float32Array(n) // 上一格畫面的位置
const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), axis = new THREE.Vector3()
function initSpin() {
  for (let b = 0; b < n; b++) {
    // 一開始隨便朝一個方向
    qa.setFromEuler(new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2))
    qa.toArray(quat, b * 4)
    lx[b] = px[b]; ly[b] = py[b]; lz[b] = pz[b]
  }
}
function draw() {
  dummy.scale.setScalar(1)
  for (let b = 0; b < n; b++) {
    const dx = px[b] - lx[b], dz = pz[b] - lz[b], dy = py[b] - ly[b]
    lx[b] = px[b]; ly[b] = py[b]; lz[b] = pz[b]
    qa.fromArray(quat, b * 4)
    // 在滾筒裡貼著筒壁滾的時候，下面是筒壁；在滑道、盤子上下面是地：都用「往下」當接觸面，夠像了
    const d = Math.hypot(dx, dz) + Math.abs(dy) * 0.3
    if (d > 1e-5) {
      axis.set(dz, 0, -dx)
      if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0)
      axis.normalize()
      qb.setFromAxisAngle(axis, d / R)
      qa.premultiply(qb).normalize()
      qa.toArray(quat, b * 4)
    }
    dummy.quaternion.copy(qa)
    dummy.position.set(px[b], DRUM.y + py[b], pz[b])
    dummy.updateMatrix()
    mesh.setMatrixAt(b, dummy.matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}

/** 抽一顆（全部照物理）：
 *  1. 滾筒加速、轉 SPIN.sec 秒（每次乘 0.85～1.15 的亂數）、減速
 *  2. 慢慢轉到出球口朝正下方，打開閘門
 *  3. 哪一顆球靠重力先穿過洞口就是抽到的，閘門馬上關；那顆球掉到滑道、滾進盤子，停下來才 resolve（回傳第幾顆球） */
let phase = 'idle', busy = null, t0 = 0, spinSec = 0, inTray = -1, resolveFn = null, rollT = 0 // rollT：球掉出來後模擬了幾秒
function play() {
  if (busy) return busy
  busy = new Promise((resolve) => {
    resolveFn = resolve
    if (inTray >= 0) { putBack(inTray); inTray = -1 }
    sim.escaped = -1
    spinSec = SPIN.sec * (0.85 + Math.random() * 0.3)
    phase = 'spin'; t0 = performance.now(); sim.moving = true
  })
  return busy
}
defineExpose({ play })

// 每一格畫面：照階段決定滾筒轉速、閘門，再算物理
function update(dt) {
  const t = (performance.now() - t0) / 1000
  if (phase === 'spin') {
    const up = Math.min(1, t / SPIN.ramp), down = Math.min(1, Math.max(0, (spinSec - t) / SPIN.ramp))
    sim.omega = SPIN.w * Math.min(up, down)
    if (t >= spinSec) { phase = 'align' }
  } else if (phase === 'align') {
    // 轉到出球口朝下（−90°）：往近的那邊轉，越接近越慢
    const diff = wrapA(-Math.PI / 2 - (HOLE.a + sim.angle))
    sim.omega = Math.sign(diff) * Math.min(SPIN.alignW, Math.abs(diff) * 4 + 0.1)
    if (Math.abs(diff) < 0.01) { sim.omega = 0; phase = 'open'; sim.gateOpen = true; t0 = performance.now() }
  } else if (phase === 'open') {
    sim.omega = 0
    if (sim.escaped >= 0) { phase = 'roll'; t0 = performance.now(); rollT = 0 }
    // 洞口上面剛好沒有球（很少見）：滾筒前後輕輕搖一下
    else if (t > 1.5) sim.omega = Math.sin(t * 8) * 0.6
  } else if (phase === 'roll') {
    sim.omega = 0
    const b = sim.escaped
    rollT += dt // 用模擬時間算（手機慢、一格畫面算比較少時，不會還沒滾到就逾時）
    const v = Math.hypot(px[b] - ox[b], py[b] - oy[b], pz[b] - oz[b]) / (dt / SUB)
    const inTrayNow = pz[b] > CHUTE.z1
    if ((inTrayNow && v < 0.8) || rollT > 3.5) {
      if (!inTrayNow) placeInTray(b) // 萬一卡在滑道上：直接放進盤子
      phase = 'idle'; inTray = b; busy = null
      resolveFn?.(b); resolveFn = null
    }
  }
  sim.angle += sim.omega * dt
  rot.rotation.z = sim.angle
  gate.visible = !sim.gateOpen
  if (sim.moving || phase !== 'idle') {
    let v = 0
    for (let k = 0; k < SUB; k++) v = Math.max(v, step(dt / SUB))
    sim.moving = v > 0.1
  }
}

// ── 球的說明：滑鼠滑過去；手機點一下（拖曳不算）、3 秒後收起來 ──
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2()
let down = null, tipTimer = 0
function pickAt(e) {
  const r = glBox.value.getBoundingClientRect()
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const hit = ray.intersectObject(mesh)[0]
  tip.value = hit ? { x: e.clientX - r.left, y: e.clientY - r.top, html: props.tipOf(hit.instanceId) } : null
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

// RWD：不管畫面多寬多長，搖獎機（含展示台、燈泡圈）都放進「招牌下緣 ～ 操作列上緣」中間的空間，招牌不會擋到它。
// 做法：先用 30° 視角把搖獎機的外框點投影到畫面，量出它佔多高多寬，再算剛好塞滿可用空間的視角、把它移到空間正中間。
const FIT_PTS = (() => {
  const pts = []
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a)
    pts.push(new THREE.Vector3(c * PED.r1, PED.floor, s * PED.r1), new THREE.Vector3(c * PED.r1, BASE.h, s * PED.r1)) // 展示台上下緣
    for (const z of [-DRUM.d / 2, DRUM.d / 2]) pts.push(new THREE.Vector3(c * (DRUM.r + 1.3), DRUM.y + s * (DRUM.r + 1.3), z)) // 滾筒＋燈泡圈
  }
  return pts
})()
const titleEl = ref(null)
const _v = new THREE.Vector3()
function resize() {
  const W = wrap.value.clientWidth, H = wrap.value.clientHeight
  if (!W || !H) return
  Object.assign(box, { x: 0, y: 0, w: W, h: H })
  renderer.setSize(box.w, box.h)
  camera.aspect = box.w / box.h
  // 可用空間：上＝招牌下緣（設計稿縮放 s 倍，再加招牌上下浮動的 8 設計 px）＋一點空隙；下＝操作列上緣
  const s = Math.min(W / 1080, H / 1350) || 1
  const t = titleEl.value
  const ss = Math.min(1, Math.max(0.55, ((H - props.insetTop - props.insetBottom) / W - 0.5) / 0.9)) // 跟 uiStyle 的 --ss 一樣
  const top = t ? (t.offsetTop + t.offsetHeight * ss + 8) * s + 10 : props.insetTop
  const bottom = H - props.insetBottom - 6
  const availH = Math.max(80, bottom - top), availW = W * 0.96
  // 先用 30° 量
  camera.fov = 30
  camera.clearViewOffset()
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of FIT_PTS) {
    _v.copy(p).project(camera)
    x0 = Math.min(x0, _v.x); x1 = Math.max(x1, _v.x); y0 = Math.min(y0, _v.y); y1 = Math.max(y1, _v.y)
  }
  // k＝要放大幾倍（視角變窄）才剛好塞滿：高、寬取比較緊的那個
  const k = Math.min(availH / (((y1 - y0) / 2) * H), availW / (((x1 - x0) / 2) * W))
  camera.fov = (Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) / k) * 360) / Math.PI
  // 放大後搖獎機中心在畫面上的位置 → 移到可用空間的正中間
  const cy = H / 2 - (((y0 + y1) / 2) * k * H) / 2, cx = W / 2 + (((x0 + x1) / 2) * k * W) / 2
  camera.setViewOffset(W, H, cx - W / 2, cy - (top + bottom) / 2, W, H)
  camera.updateProjectionMatrix()
}
// 彩帶：每次公布結果灑一次（位置、顏色、速度隨機）
const CONFETTI = ['#ffd75e', '#ff4d6d', '#4dd2ff', '#7cff6b', '#ffffff', '#c77dff']
const pieces = ref([])
watch(() => props.party, (v) => {
  pieces.value = !v ? [] : Array.from({ length: 70 }, () => ({
    left: `${Math.random() * 100}%`, background: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${2.2 + Math.random() * 1.6}s`,
    '--rot': `${Math.random() * 720 - 360}deg`, '--dx': `${Math.random() * 160 - 80}px`,
    width: `${10 + Math.random() * 10}px`, height: `${6 + Math.random() * 8}px`,
  }))
})
let last = performance.now()
function frame() {
  raf = requestAnimationFrame(frame)
  const now = performance.now(), dt = Math.min(1 / 30, (now - last) / 1000)
  last = now
  if (props.paused && phase === 'idle') return
  update(dt)
  animateBulbs(now / 1000, phase !== 'idle')
  draw()
  sway(now / 1000, dt)
  controls.update()
  renderer.render(scene, camera)
}
// 靜止時：整台搖獎機（展示台、滾筒、彩球）像展示轉盤一樣慢慢左右轉一點點（±5°、約 7 秒來回）；搖獎時慢慢轉回正面
// 只轉畫面、不動物理，手機不會多花力氣
const SWAY = { amp: 0.09, period: 7 }
let swayA = 0
function sway(t, dt) {
  const target = phase === 'idle' && !reduceMotion ? Math.sin((t * 2 * Math.PI) / SWAY.period) * SWAY.amp : 0
  swayA += (target - swayA) * Math.min(1, dt * 2.5)
  turntable.rotation.y = swayA
}
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

onMounted(() => {
  // 手機：解析度最多 1.5 倍、影子簡單一點、球不打影子（891 顆球再畫一次影子很吃效能）
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW ? 1.5 : 2))
  renderer.setClearColor(0x000000, 0) // 透明：後面是 CSS 畫的舞台
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  glBox.value.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
  // 燈光：前上方一盞暖白主燈（打影子）、左右兩盞彩色側光（洋紅、青），像攝影棚
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
  const key = new THREE.SpotLight('#fff4e0', 2600, 0, Math.PI / 7, 0.5, 1.6)
  key.position.set(8, 60, 46); key.target.position.set(0, DRUM.y * 0.6, 0)
  key.castShadow = true; key.shadow.bias = -0.0004
  key.shadow.mapSize.setScalar(LOW ? 1024 : 2048) // 手機影子貼圖小一點，比較順
  const left = new THREE.SpotLight('#ff4fa3', 1500, 0, Math.PI / 6, 0.6, 1.6); left.position.set(-40, 26, 18); left.target.position.set(0, DRUM.y, 0)
  const right = new THREE.SpotLight('#5ff2ff', 1500, 0, Math.PI / 6, 0.6, 1.6); right.position.set(40, 26, 18); right.target.position.set(0, DRUM.y, 0)
  scene.add(key, key.target, left, left.target, right, right.target)
  turntable = new THREE.Group()
  scene.add(turntable)
  turntable.add(makeMachine())
  mesh = makeBallMesh({ balls: props.balls, colors: props.colors, atlas: props.atlas, grid: props.grid, face: props.face })
  mesh.castShadow = !LOW
  turntable.add(mesh)
  initBalls()
  if (props.sel != null) placeInTray(props.sel)
  inTray = props.sel ?? -1
  initSpin()
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 500)
  // 預設視角：從右前方斜上看（方位 28°、仰角 22°），看得到滾筒的前面、側面和後面的 A 字架
  const az = THREE.MathUtils.degToRad(CAM.az), el = THREE.MathUtils.degToRad(CAM.el)
  camera.position.set(Math.sin(az) * Math.cos(el) * CAM.dist, DRUM.y * 0.85 + Math.sin(el) * CAM.dist, Math.cos(az) * Math.cos(el) * CAM.dist)
  // 鏡頭固定在預設視角，只能縮放（滾輪、兩指）：不能轉、不能平移
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, DRUM.y * 0.85, 0)
  lockSpin(controls)
  // 操作跟彩球盒一樣：單指（左鍵）左右拖曳繞著轉、兩指縮放＋移動（右鍵移動、滾輪縮放）
  controls.enablePan = true
  controls.screenSpacePanning = true
  controls.minDistance = CAM.dist * 0.3; controls.maxDistance = CAM.dist * 1.6
  ro = new ResizeObserver(resize)
  ro.observe(wrap.value)
  if (titleEl.value) ro.observe(titleEl.value) // 招牌大小變了（字型載入、換語言）也重算
  resize()
  frame()
})
watch(() => props.face, () => mesh && setBallFace(mesh, props.face))
watch(() => [props.insetTop, props.insetBottom], () => renderer && resize())
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
.lottery-drum { position: absolute; inset: 0; z-index: 2; overflow: hidden; background: #08061a; }
.stage { position: absolute; overflow: hidden; }
/* 舞台背景：賭場——深酒紅牆面（中間亮、四周暗）、上面一層金色細線菱格壁紙、中間一圈暖光、兩道聚光燈、散景光點、地上綠色牌桌絨的反光、四周壓暗 */
.stage-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; --wall-y: 55%; } /* 自己一層；牆面是共用的 .stage-wall */
.stage-bg > div, .stage-bg > .bokeh { position: absolute; pointer-events: none; }
.glow { left: 50%; top: 52%; width: 150%; aspect-ratio: 1; transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 196, 110, 0.34) 0%, rgba(255, 70, 90, 0.16) 28%, transparent 58%); }
/* 聚光燈：從上面兩角打下來、慢慢晃 */
.beam { top: -6%; width: 70%; height: 115%; opacity: 0.5; mix-blend-mode: screen; filter: blur(10px);
  background: conic-gradient(from 0deg at 50% 0%, transparent 165deg, rgba(190, 210, 255, 0.55) 176deg, rgba(255, 255, 255, 0.75) 180deg, rgba(190, 210, 255, 0.55) 184deg, transparent 195deg);
  -webkit-mask: linear-gradient(180deg, #000 0%, #000 55%, transparent 95%); mask: linear-gradient(180deg, #000 0%, #000 55%, transparent 95%); }
.beam.l { left: -22%; transform-origin: 50% 0; animation: sway 7s ease-in-out infinite alternate; }
.beam.r { right: -22%; transform-origin: 50% 0; animation: sway 7s ease-in-out infinite alternate-reverse; }
/* 探照燈：疊在 3D 上面（不擋點擊）。四盞彩色探照燈一直開著，燈頭在上面左右滑、光束亂掃，掃到的地方有一圈光斑；搖獎時掃得更快 */
.spots { position: absolute; inset: 0; overflow: hidden; pointer-events: none; mix-blend-mode: screen; --k: 1.8; }
.spots.fast { --k: 0.8; }
.spots i { position: absolute; top: calc(var(--itp, 0px) - 3%); left: 50%; width: 60%; height: 120%; margin-left: -30%; transform-origin: 50% 0;
  animation: sp-a calc(var(--d) * var(--k)) ease-in-out infinite, sp-pulse calc(1.3s * var(--k)) ease-in-out infinite alternate; }
.spots i::before { content: ''; position: absolute; inset: 0; filter: blur(3px);
  background: conic-gradient(from 0deg at 50% 0%, transparent 167deg, var(--c) 174deg, rgba(255, 255, 255, 0.45) 180deg, var(--c) 186deg, transparent 193deg);
  -webkit-mask: linear-gradient(180deg, #000 0%, #000 60%, transparent 85%); mask: linear-gradient(180deg, #000 0%, #000 60%, transparent 85%); }
/* 光斑：光束打到的地方一圈亮 */
.spots i::after { content: ''; position: absolute; left: 50%; top: 66%; width: 60%; height: 11%; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255, 255, 255, 0.3), var(--c) 55%, transparent); filter: blur(6px); }
.spots .sp1 { --c: rgba(255, 80, 160, 0.4); --d: 5.2s; }
.spots .sp2 { --c: rgba(255, 210, 90, 0.4); --d: 6.1s; animation-name: sp-b, sp-pulse; animation-delay: -2s, -0.4s; }
.spots .sp3 { --c: rgba(90, 220, 255, 0.4); --d: 4.7s; animation-name: sp-c, sp-pulse; animation-delay: -1s, -0.9s; }
.spots .sp4 { --c: rgba(180, 120, 255, 0.4); --d: 5.6s; animation-name: sp-d, sp-pulse; animation-delay: -3.3s, -0.2s; }
/* 每盞燈自己一條亂掃的路線：燈頭左右滑（translateX）＋光束轉（rotate） */
@keyframes sp-a { 0% { transform: translateX(-45%) rotate(-40deg); } 20% { transform: translateX(-20%) rotate(25deg); } 45% { transform: translateX(-50%) rotate(50deg); }
  65% { transform: translateX(-10%) rotate(-15deg); } 85% { transform: translateX(-35%) rotate(35deg); } 100% { transform: translateX(-45%) rotate(-40deg); } }
@keyframes sp-b { 0% { transform: translateX(-15%) rotate(30deg); } 25% { transform: translateX(10%) rotate(-45deg); } 50% { transform: translateX(-25%) rotate(-5deg); }
  70% { transform: translateX(5%) rotate(45deg); } 100% { transform: translateX(-15%) rotate(30deg); } }
@keyframes sp-c { 0% { transform: translateX(15%) rotate(-30deg); } 30% { transform: translateX(-10%) rotate(40deg); } 55% { transform: translateX(25%) rotate(-50deg); }
  80% { transform: translateX(0%) rotate(10deg); } 100% { transform: translateX(15%) rotate(-30deg); } }
@keyframes sp-d { 0% { transform: translateX(45%) rotate(40deg); } 20% { transform: translateX(15%) rotate(-30deg); } 40% { transform: translateX(50%) rotate(-55deg); }
  65% { transform: translateX(20%) rotate(20deg); } 85% { transform: translateX(40%) rotate(-10deg); } 100% { transform: translateX(45%) rotate(40deg); } }
@keyframes sp-pulse { from { opacity: 0.7; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .spots { --k: 4; } }
/* 手機：探照燈疊在 3D 上面，用 screen 混色＋模糊的話每一格都要重算整個畫面，很卡 → 改成一般半透明、不模糊（看起來差不多） */
@media (pointer: coarse) {
  .spots, .beam, .bokeh i { mix-blend-mode: normal; }
  .spots i::before, .spots i::after, .bokeh i { filter: none; }
  .beam { filter: none; opacity: 0.35; }
}
@keyframes sway { from { transform: rotate(-24deg); } to { transform: rotate(14deg); } }
/* 散景光點：模糊的小圓、慢慢浮動閃爍 */
.bokeh { inset: 0; }
.bokeh i { position: absolute; border-radius: 50%; filter: blur(2px); mix-blend-mode: screen; animation: bokeh ease-in-out infinite alternate; }
@keyframes bokeh { from { transform: translateY(0) scale(1); } to { transform: translateY(-14px) scale(1.25); opacity: 0.08; } }
/* 地上反光：機器底下一圈暖光 */
.floor { left: -10%; right: -10%; bottom: 0; height: 46%;
  background: radial-gradient(60% 40% at 50% 38%, rgba(255, 190, 120, 0.24), transparent 70%), radial-gradient(90% 70% at 50% 60%, rgba(20, 110, 60, 0.55), transparent 75%), linear-gradient(180deg, transparent, rgba(6, 4, 4, 0.6)); }
.vignette { inset: 0; background: radial-gradient(130% 90% at 50% 50%, transparent 55%, rgba(8, 2, 4, 0.75) 100%); }
/* 撲克牌花色：慢慢飄、轉一點 */
.suits { inset: 0; }
.suits i { position: absolute; font-style: normal; line-height: 1; text-shadow: 0 0 12px currentColor; animation: suit ease-in-out infinite alternate; }
@keyframes suit { from { transform: translateY(0) rotate(var(--r)); } to { transform: translateY(-22px) rotate(calc(var(--r) * -1)); } }
.stage-gl { position: absolute; inset: 0; touch-action: none; }
.stage-gl :deep(canvas) { display: block; }
/* 寬 1080 的設計稿，縮放到舞台（寬高由 uiStyle 給） */
.stage-ui { position: absolute; left: 0; top: 0; width: 1080px; height: 1350px; transform-origin: 0 0; pointer-events: none;
  font-family: 'Overpass', 'Huninn', 'NanumSquareRoundB', 'Noto Sans TC', sans-serif; }
/* 節目標題：賭場霓虹招牌——黑底板、外圈粉紅霓虹燈管、內圈青色燈管；字是霓虹燈管字（白芯＋一層層同色光暈），會微微呼吸、偶爾閃一下 */
.show-title { position: absolute; left: 50%; top: calc(64px + var(--it, 0px)); transform: translateX(-50%) scale(var(--ss, 1)); transform-origin: 50% 0; width: 880px; text-align: center; animation: st-float 4.5s ease-in-out infinite; }
@keyframes st-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -8px; } }
/* 結果看板（index.vue 的 slot）：貼著下面，放在搖獎機底座下面、不擋到機器 */
.show-board { position: absolute; left: 50%; bottom: calc(60px + var(--ib, 0px)); transform: translateX(-50%) scale(1.15); transform-origin: 50% 100%; pointer-events: auto; }
/* 彩帶 */
.confetti { position: absolute; inset: 0; overflow: hidden; }
.confetti i { position: absolute; top: -30px; border-radius: 2px; animation-name: fall; animation-timing-function: cubic-bezier(0.3, 0.5, 0.6, 1); animation-fill-mode: forwards; }
@keyframes fall { to { transform: translate(var(--dx), var(--fall, 1420px)) rotate(var(--rot)); } }
/* 跑馬燈：四邊各一排燈泡（暗的一排＋亮的一排），亮的那排的背景位置一直往前移，看起來就是燈在繞圈跑（上→右→下→左，順時針） */
.marquee { position: absolute; inset: calc(10px + var(--it, 0px)) 10px 10px; pointer-events: none; z-index: 2; --gap: 30px; --dur: 1.1s; }
.marquee.fast { --dur: 0.35s; }
.marquee i { position: absolute; filter: drop-shadow(0 0 6px #ffd75e); }
.marquee .mt, .marquee .mb { left: 0; right: 0; height: 20px; background-repeat: repeat-x; }
.marquee .ml, .marquee .mr { top: 0; bottom: 0; width: 20px; background-repeat: repeat-y; }
.marquee .mt { top: 0; } .marquee .mb { bottom: 0; } .marquee .ml { left: 0; } .marquee .mr { right: 0; }
.marquee .mt, .marquee .mb { background-image: radial-gradient(circle, #fffbe6 0 5px, #ffcf3a 6.5px, transparent 8px), radial-gradient(circle, #7a4a10 0 4px, transparent 5px);
  background-size: calc(var(--gap) * 3) 20px, var(--gap) 20px; }
.marquee .ml, .marquee .mr { background-image: radial-gradient(circle, #fffbe6 0 5px, #ffcf3a 6.5px, transparent 8px), radial-gradient(circle, #7a4a10 0 4px, transparent 5px);
  background-size: 20px calc(var(--gap) * 3), 20px var(--gap); }
.marquee .mt { animation: mq-r var(--dur) steps(3) infinite; }
.marquee .mb { animation: mq-l var(--dur) steps(3) infinite; }
.marquee .mr { animation: mq-d var(--dur) steps(3) infinite; }
.marquee .ml { animation: mq-u var(--dur) steps(3) infinite; }
@keyframes mq-r { from { background-position: 0 0, 0 0; } to { background-position: calc(var(--gap) * 3) 0, 0 0; } }
@keyframes mq-l { from { background-position: 0 0, 0 0; } to { background-position: calc(var(--gap) * -3) 0, 0 0; } }
@keyframes mq-d { from { background-position: 0 0, 0 0; } to { background-position: 0 calc(var(--gap) * 3), 0 0; } }
@keyframes mq-u { from { background-position: 0 0, 0 0; } to { background-position: 0 calc(var(--gap) * -3), 0 0; } }
.drum-tip { position: absolute; pointer-events: none; z-index: 5; max-width: min(240px, 70%); }
</style>
