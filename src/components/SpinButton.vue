<template>
  <!-- 搖一搖：街機按鈕（金框上一圈會跑的燈泡、紅色圓頂、兩邊閃星星）；字一個一個可愛地搖，搖獎中抖得比較快 -->
  <button type="button" class="draw" :class="{ busy: spinning }" :disabled="spinning || disabled" @click="emit('spin')">
    <i class="d-bulbs" aria-hidden="true"></i>
    <span class="d-dome"><i v-if="!spinning" class="d-star" aria-hidden="true">★</i><b :aria-label="spinning ? L('SPINNING', '搖獎中', '抽選中', '추첨 중') : idleLabel"><span v-for="(ch, i) in [...(spinning ? L('SPINNING', '搖獎中', '抽選中', '추첨 중') : idleLabel)]" :key="`${spinning}${i}`" class="d-ch" :style="{ '--i': i }" aria-hidden="true">{{ ch }}</span></b><i v-if="!spinning" class="d-star r" aria-hidden="true">★</i><i v-if="spinning" class="d-dots"><i></i><i></i><i></i></i></span>
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { L } from '../i18n.js'
import { spinning } from '../store.js'
const props = defineProps({
  disabled: { type: Boolean, default: false },
  shake: { type: Boolean, default: false }, // 這台裝置現在可以搖手機：按鈕寫「手機搖一搖」
})
const idleLabel = computed(() => (props.shake ? L('SHAKE OR TAP', '手機搖一搖', 'スマホを振ろう', '폰을 흔들어요') : L('SPIN', '搖一搖', '回す', '돌리기')))
const emit = defineEmits(['spin'])
</script>
