<template>
  <!-- 資訊面板：結果、歷史、獎項、說明四個分頁 -->
  <BottomSheet :open="sheet" :label="L('Info', '資訊', '情報', '정보')" @close="close">
    <template #head>
      <nav class="tabs" role="tablist">
        <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="setTab(t.key)">{{ t.label }}</button>
      </nav>
      <button type="button" class="close" :aria-label="L('Close', '關閉', '閉じる', '닫기')" @click="close">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
      </button>
    </template>
    <main class="content">
      <ResultTab v-if="tab === 'result'" />
      <HistoryTab v-else-if="tab === 'history'" />
      <PrizeTab v-else-if="tab === 'prize'" />
      <AboutTab v-else />
    </main>
  </BottomSheet>
</template>

<script setup>
import BottomSheet from './BottomSheet.vue'
import ResultTab from './info/ResultTab.vue'
import HistoryTab from './info/HistoryTab.vue'
import PrizeTab from './info/PrizeTab.vue'
import AboutTab from './info/AboutTab.vue'
import { L } from '../i18n.js'
import { SHOW_PRIZE } from '../lottery.js'
import { sheet, tab } from '../store.js'

const TABS = [['result', 'Result', '結果', '結果', '결과'], ['history', 'History', '歷史', '履歴', '기록'], SHOW_PRIZE ? ['prize', 'Prizes', '獎項', '賞', '상'] : ['prize', 'Stats', '統計', '統計', '통계'], ['about', 'About', '說明', '説明', '설명']].map(([key, ...t]) => ({ key, get label() { return L(...t) } }))
const close = () => (sheet.value = false)
const setTab = (k) => (tab.value = k)
</script>
