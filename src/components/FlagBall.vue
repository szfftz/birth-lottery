<!-- 國旗球：圓形，國旗置中（不捲動）；左上一點高光、邊緣壓暗，像顆圓球。大小由外面的 class 給（.fl、.c-flag…） -->
<template>
  <i class="flag-ball" aria-hidden="true"><i class="fb-face" :style="flagStyle(iso)"></i></i>
</template>

<script setup>
import { flagStyle } from '../lottery.js'
defineProps({ iso: { type: String, required: true } })
</script>

<style scoped>
.flag-ball { position: relative; display: inline-block; flex: none; border-radius: 50%; overflow: hidden; }
.fb-face { position: absolute; inset: 0; }
.flag-ball::after { content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 32%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.35) 100%); }
</style>
