<template>
  <!-- 左上：頁面名稱＋模式選單（漢堡合在一起），按下去往下展開；最下面一項打開「結果與說明」 -->
  <div v-if="menu" class="menu-scrim" @click="close"></div>
  <nav class="modes" :style="{ top: `${top}px` }" :aria-label="L('Modes', '模式', 'モード', '모드')">
    <button type="button" class="mode-title" :class="{ on: menu }" :aria-expanded="menu" :aria-label="L('Switch mode', '切換模式', 'モード切替', '모드 전환')" :disabled="spinning" @click="toggle">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path :d="menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
      <span>{{ modeLabel }}</span>
    </button>
    <Transition name="menu">
      <ul v-if="menu" class="menu glass" role="menu">
        <li v-for="m in MODES" :key="m.key">
          <button type="button" role="menuitemradio" :aria-checked="mode === m.key" :class="{ on: mode === m.key }" @click="setMode(m.key); close()">
            <i class="m-dot"></i>{{ m.label }}
          </button>
        </li>
        <li class="m-sep" role="separator"></li>
        <li>
          <button type="button" role="menuitem" @click="close(); openSheet()">
            <svg class="m-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>{{ L('Results & info', '結果與說明', '結果と説明', '결과와 설명') }}
            <span v-if="total" class="m-badge">{{ total > 99 ? '99+' : total }}</span>
          </button>
        </li>
      </ul>
    </Transition>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { L } from '../i18n.js'
import { MODES, mode } from '../lottery.js'
import { menu, spinning, total, setMode, openSheet } from '../store.js'
defineProps({ top: { type: Number, default: 8 } }) // 離畫面最上面幾 px（避開狀態列）
const close = () => (menu.value = false)
const toggle = () => (menu.value = !menu.value)
const modeLabel = computed(() => MODES.find((m) => m.key === mode.value)?.label ?? '')
</script>
