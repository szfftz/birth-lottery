<template>
  <!-- 出生搖搖樂：整個畫面就是舞台（3D 樂透搖獎機），下面浮著「搖一搖」；左上頁面名稱＋選單、右上語言切換。
       地圖、彩球盒、資訊（結果、歷史、獎項、說明）都是從下面拉上來的面板。
       舞台蓋滿整個畫面（含狀態列、搖一搖後面）；insets＝上面狀態列、下面搖一搖擋住的高度，傳給搖獎機把機器放在看得到的地方。
       手機、iPad 滿版；電腦上照直式手機比例置中 -->
  <div ref="phoneEl" class="phone">
    <i ref="safeTopEl" class="safe-top" aria-hidden="true"></i>
    <div class="stage-wrap">
      <Transition name="fade"><LoadingScreen v-if="!atlas" /></Transition>
      <LotteryDrum v-if="atlas" ref="drum" :balls="balls" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]" :paused="mode !== 'game'"
        face="flag" :sel="lastBall" :tip-of="ballTip" :party="spinning ? 0 : total" :spinning="spinning" :inset-top="topInset" :inset-bottom="insets.bottom">
        <!-- 抽完在搖獎機下面顯示中獎看板；點了打開結果分頁 -->
        <Transition name="board">
          <div v-if="last && !spinning && lastBall != null" :key="total" class="rb-wrap" :style="{ '--tier': colorOf(last) }" @click="openSheet('result')">
            <i v-for="k in 8" :key="k" class="rb-star" :class="`s${k}`">✦</i>
            <ResultBoard :iso="last" />
          </div>
        </Transition>
      </LotteryDrum>
    </div>

    <LangSwitch :style="{ top: `${insets.top + 8}px` }" />
    <ModeMenu :top="insets.top + 8" />
    <div ref="dockEl" class="dock" @click.self="!spinning && atlas && draw()"><SpinButton :disabled="!atlas" :shake="shake.ready.value" @spin="draw" /></div>

    <ViewSheet :open="!!atlas && mode !== 'game'" :atlas="atlas" :inset-bottom="safeBottom" />
    <InfoSheet />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import LoadingScreen from './components/LoadingScreen.vue'
import LotteryDrum from './components/LotteryDrum.vue'
import ResultBoard from './components/ResultBoard.vue'
import LangSwitch from './components/LangSwitch.vue'
import ModeMenu from './components/ModeMenu.vue'
import SpinButton from './components/SpinButton.vue'
import ViewSheet from './components/ViewSheet.vue'
import InfoSheet from './components/InfoSheet.vue'
import { useShake } from './composables/useShake.js'
import { dbg } from './lib/debug.js'
import { mode, balls, isoOfBall, colors, flagMeta, flagsUrl, ballTip, tierIdx, colorOf } from './lottery.js'
import { last, lastBall, total, spinning, sheet, tab, openSheet, setMode, record } from './store.js'

// ── 版面：舞台蓋滿整個畫面；上面狀態列、下面「搖一搖」擋住的高度（px） ──
const phoneEl = ref(null), dockEl = ref(null), safeTopEl = ref(null)
const insets = reactive({ top: 0, bottom: 0 })
const DOCK_PAD = 14 // 搖一搖外面多一圈可以按的範圍（跟 .dock 的 padding 一樣）
const LANG_H = 44 // 最上面一排（頁面名稱、語言切換）佔的高度：搖獎機的招牌往下讓這麼多
const topInset = computed(() => insets.top + LANG_H)
// 手機最下面的安全區（Home 條）高度：地圖、彩球盒面板蓋住搖一搖，只要避開這一塊
const safeBottom = ref(0)
function measure() {
  if (!phoneEl.value || !dockEl.value) return
  const ph = phoneEl.value.getBoundingClientRect(), dk = dockEl.value.getBoundingClientRect()
  insets.top = Math.round(safeTopEl.value?.offsetHeight ?? 0)
  insets.bottom = Math.round(ph.bottom - dk.top - DOCK_PAD) // 扣掉按鈕外面那圈「也可以按」的範圍，只算按鈕本身
}
let insetRo
onMounted(() => {
  const t = document.createElement('i')
  t.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden'
  document.body.appendChild(t); safeBottom.value = t.offsetHeight; t.remove()
  insetRo = new ResizeObserver(measure)
  insetRo.observe(phoneEl.value)
  insetRo.observe(dockEl.value)
  measure()
})
onBeforeUnmount(() => insetRo?.disconnect())

// ── 國旗拼圖（three.js 貼圖用）：一律用 <img> 載入。不用 createImageBitmap：有些 iPhone Safari 把 ImageBitmap 傳進 WebGL 會變全黑 ──
const atlas = ref(null)
function loadImg() {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = flagsUrl })
}
loadImg().then((a) => (atlas.value = a)).catch(() => setTimeout(() => loadImg().then((a) => (atlas.value = a)), 1500))

// ── 抽獎：一律回到搖獎機搖，掉出來的那顆就是（抽到誰由物理模擬決定）；抽到沒有 HDI 的國家就自動再搖 ──
const drum = ref(null)
let drawing = false // 正在抽：連按、搖手機都不會同時抽兩次
let coolUntil = 0 // 剛搖完 1.5 秒內不理搖手機
const shake = useShake({
  canShake: () => !spinning.value && !drawing && performance.now() > coolUntil && mode.value === 'game' && !!atlas.value && !sheet.value,
  onShake: () => draw(),
})
async function draw() {
  shake.enable() // 第一次按：iPhone 要在按鈕裡問「動作與方向」權限
  dbg(`draw()　搖獎中:${spinning.value}　正在抽:${drawing}　搖獎機:${!!drum.value}　國旗:${!!atlas.value}`)
  if (spinning.value || drawing || !drum.value) return
  drawing = true
  try {
    setMode('game')
    spinning.value = true
    tab.value = 'result'
    let b, iso, redraws = 0
    for (;;) {
      b = await drum.value.play()
      iso = isoOfBall(b)
      if (tierIdx(iso) >= 0) break
      redraws++
    }
    spinning.value = false
    record(iso, b, redraws)
  } finally {
    spinning.value = false
    drawing = false
    coolUntil = performance.now() + 1500
  }
}
</script>
