<template>
  <!-- 語言切換：四顆國旗球（台灣＝中文、英國＝英文、日本＝日文、韓國＝韓文）；選中的那顆金框、放大，其他的暗一點（預設中文，選過的記在瀏覽器） -->
  <div class="lang-switch glass" role="group" aria-label="Language / 語言 / 言語 / 언어">
    <button v-for="[k, flag, , name] in LANGS" :key="k" type="button" class="lang-ball" :class="{ on: lang === k }" :aria-pressed="lang === k" :aria-label="name" :title="name" @click="setLang(k)">
      <FlagBall :iso="flag" />
    </button>
  </div>
</template>

<script setup>
import FlagBall from './FlagBall.vue'
import { lang, LANGS } from '../i18n.js'
const setLang = (k) => (lang.value = k)
</script>

<style scoped>
/* 國旗球按鈕：蓋過共用的 .lang-switch button.on（紅色圓頂），改成金框圈住國旗球 */
.lang-switch .lang-ball { display: grid; place-items: center; min-width: 0; width: 34px; height: 34px; padding: 0; border-radius: 50%; background: none; box-shadow: none; }
.lang-ball .flag-ball { width: 24px; height: 24px; opacity: 0.55; filter: saturate(0.7); transition: transform 0.15s, opacity 0.15s, filter 0.15s; }
.lang-switch .lang-ball.on { background: none; box-shadow: none; }
.lang-ball.on .flag-ball { opacity: 1; filter: none; transform: scale(1.12); box-shadow: 0 0 0 2px var(--gold), 0 0 10px rgba(255, 196, 90, 0.7); }
@media (hover: hover) { .lang-switch .lang-ball:not(.on):hover { background: none; } .lang-ball:not(.on):hover .flag-ball { opacity: 0.9; filter: none; } }
</style>
