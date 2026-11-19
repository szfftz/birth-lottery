<template>
  <!-- 中獎看板（舞台上、結果分頁共用）：燈泡框、會轉的國旗球、斜體描邊國名、獎牌、小世界地圖
       ticket＝結果分頁的票卡版（獎牌斜貼在右上、國名上面多一行標題，下面插槽放數字方塊） -->
  <article class="result-board" :class="{ 't-board': ticket }" :style="{ '--tier': colorOf(iso) }">
    <div class="rb-bulbs"></div>
    <div class="rb-shine"></div>
    <PrizeMedal v-if="ticket && SHOW_PRIZE" class="t-medal" :iso="iso" />
    <div class="rb-body" :class="{ 't-body': ticket }">
      <!-- 中獎的國旗球：兩面國旗並排成一條帶子，一直往左捲，看起來像球在水平轉 -->
      <div class="rb-ball"><div class="rb-flag"><div class="rb-roll"><i :style="flagStyle(iso)"></i><i :style="flagStyle(iso)"></i></div></div></div>
      <div class="rb-main">
        <div v-if="title" class="t-title" :style="{ '--fit': fitScale(title, TITLE_CAP, 0.5) }">{{ title }}</div>
        <div class="rb-name" :class="{ wrap: needsWrap(nameOf(iso), nameCap) }" :style="{ '--fit': fitScale(nameOf(iso), nameCap) }">{{ nameOf(iso) }}</div>
      </div>
      <PrizeMedal v-if="!ticket && SHOW_PRIZE" :iso="iso" />
    </div>
    <WorldLocator compact :class="ticket ? 't-map' : 'rb-map'" :iso="iso" :color="colorOf(iso)" />
    <slot />
  </article>
</template>

<script setup>
import PrizeMedal from './PrizeMedal.vue'
import WorldLocator from './WorldLocator.vue'
import { colorOf, flagStyle, nameOf, SHOW_PRIZE } from '../lottery.js'
import { fitScale, needsWrap } from '../lib/fit.js'
import { computed } from 'vue'

// 國名、標題放得下幾個全形字（照設計稿的寬度算）：超過就縮小字，不換行、不被右上角的獎牌蓋到
const TITLE_CAP = 10 // 票卡的標題（11px，國名上面那一行）
const props = defineProps({
  iso: { type: String, required: true },
  ticket: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
const nameCap = computed(() => (props.ticket ? 3.6 : 4.6)) // 票卡 34px 字、舞台看板 54px 字
</script>
