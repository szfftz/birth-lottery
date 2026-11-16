<!-- 國旗球：圓形、兩面國旗並排成一條帶子往左捲，看起來像球在水平轉；左上一點高光、邊緣壓暗，像顆圓球。
     大小由外面的 class 給（.fl、.c-flag…） -->
<template>
  <i class="flag-ball" aria-hidden="true"><i class="fb-roll"><i :style="flagStyle(iso)"></i><i :style="flagStyle(iso)"></i></i></i>
</template>

<script setup>
import { flagStyle } from '../lottery.js'
defineProps({ iso: { type: String, required: true } })
</script>

<style scoped>
.flag-ball { position: relative; display: inline-block; flex: none; border-radius: 50%; overflow: hidden; }
.fb-roll { position: absolute; top: 0; left: 0; display: flex; width: 200%; height: 100%; animation: fb-roll 4s linear infinite; }
.fb-roll i { flex: none; width: 50%; height: 100%; }
@keyframes fb-roll { to { transform: translateX(-50%); } }
.flag-ball::after { content: ''; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.7) 0, rgba(255, 255, 255, 0) 32%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.35) 100%); }
@media (prefers-reduced-motion: reduce) { .fb-roll { animation: none; } }
</style>
