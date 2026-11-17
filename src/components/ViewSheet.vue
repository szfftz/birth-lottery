<template>
  <!-- 遊戲以外的頁面（地圖、世界彩球盒、獎項彩球盒）：從下面拉上來，蓋住搖獎機和搖一搖（搖一搖只在遊戲頁）；點外面、按 ✕、往下拖回到遊戲 -->
  <BottomSheet :open="open" :label="modeLabel" sheet-class="view-sheet" scrim-class="view-scrim" @close="setMode('game')">
    <template #head>
      <h2 class="vs-title">{{ modeLabel }}</h2>
      <button v-if="mode === 'map'" type="button" class="pill vs-reset vs-tog" :class="{ off: !showTally }" :aria-pressed="showTally" @click="toggleTally">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2.2" fill="none" /><circle cx="12" cy="12" r="2.4" fill="currentColor" /></svg>{{ L('Draws', '抽過的', '当たった国', '뽑힌 나라') }}
      </button>
      <button type="button" class="pill vs-reset" @click="view?.resetView()">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>{{ L('RESET', '重設', 'リセット', '초기화') }}
      </button>
      <button type="button" class="close" :aria-label="L('Close', '關閉', '閉じる', '닫기')" @click="setMode('game')">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
      </button>
    </template>
    <div class="vs-body">
      <WorldMap v-if="mode === 'map'" ref="view" :show-tally="showTally" :last="last" :counts="counts" :total="total" :inset-bottom="insetBottom" />
      <LotteryBox v-else ref="view" :key="mode" :balls="balls" :cells="mode === 'boxp' ? boxRank.cells : worldCells" :cols="cellMeta.cols" :rows="cellMeta.rows"
        :walls="mode === 'boxp' ? boxRank.walls : []" :frames="mode === 'boxp' ? boxRank.frames : []" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]"
        face="flag" :sel="lastBall" :tip-of="ballTip" bg="#0d0926" :inset-top="0" :inset-bottom="insetBottom" />
    </div>
  </BottomSheet>
</template>

<script setup>
import { computed, ref } from 'vue'
import BottomSheet from './BottomSheet.vue'
import WorldMap from './WorldMap.vue'
import LotteryBox from './LotteryBox.vue'
import { L } from '../i18n.js'
import { MODES, mode, balls, boxRank, worldCells, cellMeta, colors, flagMeta, ballTip } from '../lottery.js'
import { last, lastBall, counts, total, showTally, setMode } from '../store.js'

defineProps({
  open: { type: Boolean, default: false },
  atlas: { type: Object, default: null }, // 國旗拼圖
  insetBottom: { type: Number, default: 0 }, // 最下面的安全區（iPhone 的 Home 條）
})
const view = ref(null) // 地圖或彩球盒（兩個都有 resetView()）
const modeLabel = computed(() => MODES.find((m) => m.key === mode.value)?.label ?? '')
const toggleTally = () => (showTally.value = !showTally.value)
</script>
