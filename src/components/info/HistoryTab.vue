<template>
  <!-- 歷史分頁：抽過的結果（左邊國旗＋國名，右邊地圖顏色的圓點、HDI、排名），可以選排序（時間近到遠／遠到近、獎項大到小／小到大）；點一筆＝回到那一次，跳到結果分頁看詳細資料 -->
  <section>
    <div class="h-row">
      <h3>{{ L('Draw history', '抽過的結果', '抽選の履歴', '뽑기 기록') }}<small>{{ L(`${total.toLocaleString('en-US')} ${total === 1 ? 'draw' : 'draws'}`, `共 ${total.toLocaleString('en-US')} 次`, `全 ${total.toLocaleString('en-US')} 回`, `총 ${total.toLocaleString('en-US')}번`) }}</small></h3>
      <!-- 排序下拉（跟左上的模式選單同一種樣式）：時間近到遠（預設）、時間遠到近、獎項大到小、獎項小到大 -->
      <div v-if="history.length" class="h-sort">
        <div v-if="open" class="h-sort-scrim" @click="open = false"></div>
        <button type="button" class="pill h-sort-btn" :class="{ on: open }" aria-haspopup="menu" :aria-expanded="open" :aria-label="L('Sort', '排序', '並べ替え', '정렬')" @click="open = !open">
          {{ L(...SORTS[sort]) }}<svg viewBox="0 0 12 8" width="11" height="8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <Transition name="menu">
          <ul v-if="open" class="menu glass" role="menu">
            <li v-for="(label, k) in SORTS" :key="k">
              <button type="button" role="menuitemradio" :aria-checked="sort === k" :class="{ on: sort === k }" @click="sort = k; open = false"><i class="m-dot"></i>{{ L(...label) }}</button>
            </li>
          </ul>
        </Transition>
      </div>
      <button v-if="history.length" type="button" class="pill clear" :disabled="spinning" @click="clearHistory">{{ L('Clear', '清空', 'クリア', '지우기') }}</button>
    </div>
    <ol v-if="history.length" class="rows h-rows" :class="{ 'no-medal': !SHOW_PRIZE }">
      <li v-for="h in rows" :key="h.n" :class="{ on: h.n === lastN }" @click="pickDraw(h)">
        <span class="r-n">{{ h.n }}</span>
        <!-- 獎章：金邊小圓牌，底色是獎項色，寫獎項短名 -->
        <i v-if="SHOW_PRIZE" class="r-medal" :style="{ '--tier': colorOf(h.iso), ...fit(tierShort(tierIdx(h.iso)), 2.2, 0.55) }">{{ tierShort(tierIdx(h.iso)) }}</i>
        <FlagBall class="fl" :iso="h.iso" />
        <span class="r-name solo" :style="fit(nameOf(h.iso), R_CAP, 0.6)">{{ nameOf(h.iso) }}</span>
        <!-- 右邊：這一國在地圖上的顏色（圓點，在 HDI 前面）、HDI、聯合國排名 -->
        <span v-if="!SHOW_PRIZE" class="r-hdi"><i class="r-dot" :style="{ background: hdiColor(h.iso) }"></i><b>{{ C[h.iso].hdi?.toFixed(3) ?? '—' }}</b><small>{{ C[h.iso].hdi_rank ? `${C[h.iso].hdi_rank}/${RANK_TOTAL}` : "" }}</small></span>
      </li>
    </ol>
    <div v-else class="card empty"><p class="e-main">{{ L('No draws yet', '還沒抽過', 'まだ抽選していません', '아직 뽑지 않았어요') }}</p><p class="e-sub">{{ L('Press SPIN and every result will be listed here.', '按「搖一搖」抽一次，結果會一筆一筆記在這裡。', '「回す」を押すと、結果がここに記録されます。', '「돌리기」를 누르면 결과가 여기에 기록돼요.') }}</p></div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import FlagBall from '../FlagBall.vue'
import { fit } from '../../lib/fit.js'
const R_CAP = 8 // 國名放得下幾個全形字（國旗＋國名置中，左右各留獎章那麼寬）
import { L } from '../../i18n.js'
import { C, nameOf, colorOf, hdiColor, RANK_TOTAL, tierIdx, tierShort, SHOW_PRIZE } from '../../lottery.js'
import { history, historyDesc, total, lastN, spinning, pickDraw, clearHistory } from '../../store.js'
// 排序：時間近到遠（預設）、遠到近；獎項大到小、小到大（同一獎照 HDI 排，再一樣就新的在前）
const SORTS = {
  new: ['Newest', '時間近到遠', '新しい順', '최신순'],
  old: ['Oldest', '時間遠到近', '古い順', '오래된순'],
  hdi: ['HDI high to low', 'HDI 高到低', 'HDI 高い順', 'HDI 높은순'], // 一樣高就新的在前
  hdiLow: ['HDI low to high', 'HDI 低到高', 'HDI 低い順', 'HDI 낮은순'],
  ...(SHOW_PRIZE ? {
    top: ['Top prize', '獎項大到小', '賞の高い順', '높은 상 순'],
    low: ['Lowest prize', '獎項小到大', '賞の低い順', '낮은 상 순'],
  } : {}), // 不顯示獎項時只剩時間兩種
}
const sort = ref('new'), open = ref(false)
const byPrize = (a, b) => tierIdx(a.iso) - tierIdx(b.iso) || C[b.iso].hdi - C[a.iso].hdi
const rows = computed(() => {
  const d = historyDesc.value
  if (sort.value === 'new') return d
  if (sort.value === 'old') return history.slice()
  if (sort.value === 'hdi') return d.slice().sort((a, b) => (C[b.iso].hdi ?? -1) - (C[a.iso].hdi ?? -1))
  if (sort.value === 'hdiLow') return d.slice().sort((a, b) => (C[a.iso].hdi ?? 2) - (C[b.iso].hdi ?? 2))
  return d.slice().sort(sort.value === 'top' ? byPrize : (a, b) => byPrize(b, a))
})
</script>
