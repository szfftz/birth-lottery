<template>
  <!-- 歷史分頁：抽過的結果，新的在上面；點一筆＝回到那一次，跳到結果分頁看詳細資料 -->
  <section>
    <div class="h-row">
      <h3>{{ L('Draw history', '抽過的結果', '抽選の履歴', '뽑기 기록') }}<small>{{ L(`${total.toLocaleString('en-US')} ${total === 1 ? 'draw' : 'draws'} · newest first`, `共 ${total.toLocaleString('en-US')} 次・新的在上面`, `全 ${total.toLocaleString('en-US')} 回・新しい順`, `총 ${total.toLocaleString('en-US')}번 · 최신순`) }}</small></h3>
      <button v-if="history.length" type="button" class="pill clear" :disabled="spinning" @click="clearHistory">{{ L('Clear', '清空', 'クリア', '지우기') }}</button>
    </div>
    <ol v-if="history.length" class="rows">
      <li v-for="h in historyDesc" :key="h.n" :class="{ on: h.n === lastN }" @click="pickDraw(h)">
        <span class="r-n">{{ h.n }}</span>
        <!-- 獎章：金邊小圓牌，底色是獎項色，寫獎項短名 -->
        <i class="r-medal" :style="{ '--tier': colorOf(h.iso), ...fit(tierShort(tierIdx(h.iso)), 2.2, 0.55) }">{{ tierShort(tierIdx(h.iso)) }}</i>
        <FlagBall class="fl" :iso="h.iso" />
        <span class="r-name solo" :style="fit(nameOf(h.iso), R_CAP, 0.6)">{{ nameOf(h.iso) }}</span>
        <b class="r-v">{{ h.time }}<small v-if="h.ball != null">#{{ h.ball + 1 }}</small></b>
      </li>
    </ol>
    <div v-else class="card empty"><p class="e-main">{{ L('No draws yet', '還沒抽過', 'まだ抽選していません', '아직 뽑지 않았어요') }}</p><p class="e-sub">{{ L('Press SPIN and every result will be listed here.', '按「搖一搖」抽一次，結果會一筆一筆記在這裡。', '「回す」を押すと、結果がここに記録されます。', '「돌리기」를 누르면 결과가 여기에 기록돼요.') }}</p></div>
  </section>
</template>

<script setup>
import FlagBall from '../FlagBall.vue'
import { fit } from '../../lib/fit.js'
const R_CAP = 8 // 國名放得下幾個全形字（前面多了獎章，比其他清單窄一點）
import { L } from '../../i18n.js'
import { nameOf, colorOf, tierIdx, tierShort } from '../../lottery.js'
import { history, historyDesc, total, lastN, spinning, pickDraw, clearHistory } from '../../store.js'
</script>
