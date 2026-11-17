<template>
  <!-- 中獎看板（舞台上、結果分頁共用）：燈泡框、轉動的國旗球、斜體描邊國名、獎牌、小世界地圖
       ticket＝結果分頁的票卡版（獎牌斜貼在右上、國名上面多一行標題，下面插槽放數字方塊） -->
  <article class="result-board" :class="{ 't-board': ticket }" :style="{ '--tier': colorOf(iso) }">
    <div class="rb-bulbs"></div>
    <div class="rb-shine"></div>
    <PrizeMedal v-if="ticket" class="t-medal" :iso="iso" />
    <div class="rb-body" :class="{ 't-body': ticket }">
      <!-- 國旗球：兩面國旗並排成一條帶子，往左捲動，看起來像球在水平轉 -->
      <div class="rb-ball"><div class="rb-flag"><div class="rb-roll"><i :style="flagStyle(iso)"></i><i :style="flagStyle(iso)"></i></div></div></div>
      <div class="rb-main"><div v-if="title" class="t-title">{{ title }}</div><div class="rb-name">{{ nameOf(iso) }}</div></div>
      <PrizeMedal v-if="!ticket" :iso="iso" />
    </div>
    <WorldLocator compact :class="ticket ? 't-map' : 'rb-map'" :iso="iso" :color="colorOf(iso)" />
    <slot />
  </article>
</template>

<script setup>
import PrizeMedal from './PrizeMedal.vue'
import WorldLocator from './WorldLocator.vue'
import { colorOf, flagStyle, nameOf } from '../lottery.js'
defineProps({
  iso: { type: String, required: true },
  ticket: { type: Boolean, default: false },
  title: { type: String, default: '' },
})
</script>
