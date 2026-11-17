<template>
  <!-- 獎牌：金色硬幣＋兩條緞帶，硬幣上寫獎項（中日韓寫短名，英文多一行 PRIZE） -->
  <div class="rb-medal">
    <i class="md-tail l"></i><i class="md-tail r"></i>
    <div class="md-coin">
      <div class="md-face" :class="{ long: tierShort(tierIdx(iso)).length > (isCJK() ? 2 : 3) }">
        <b>{{ tierShort(tierIdx(iso)) }}</b><small v-if="!isCJK()">PRIZE</small>
      </div>
    </div>
  </div>
</template>

<script setup>
import { isCJK } from '../i18n.js'
import { tierIdx, tierShort } from '../lottery.js'
defineProps({ iso: { type: String, required: true } })
</script>
