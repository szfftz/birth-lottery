<template>
  <!-- 獎項分頁（不顯示獎項時叫「統計」，中間每一獎那一段藏起來）：上面是你抽的成績，中間每一獎的「應該中幾成 vs 你中幾成」，下面全部國家 -->
  <section>
    <h3>{{ L('Your results', '你的成績', 'あなたの成績', '나의 성적') }}</h3>
    <div class="tiles">
      <div class="tile"><span v-fit>{{ L('Draws', '已抽', '抽選回数', '뽑은 횟수') }}</span><b v-fit>{{ total.toLocaleString('en-US') }}<em v-if="isCJK()">{{ L('', '次', '回', '번') }}</em></b><small v-fit>{{ L(`${Object.keys(counts).length} ${Object.keys(counts).length === 1 ? 'country' : 'countries'}${rerolls ? ` · ${rerolls} redrawn` : ''}`, `抽到 ${Object.keys(counts).length} 國${rerolls ? `・重抽 ${rerolls}` : ''}`, `${Object.keys(counts).length} か国${rerolls ? `・引き直し ${rerolls}` : ''}`, `${Object.keys(counts).length}개국${rerolls ? ` · 다시 뽑기 ${rerolls}` : ''}`) }}</small></div>
      <div class="tile"><span v-fit>{{ L('Average HDI', '平均人類發展指數', '平均 HDI', '평균 HDI') }}</span><b v-fit>{{ total ? drawnMean.toFixed(3) : '—' }}</b><small v-fit>{{ L('Expected worldwide', '全世界期望值', '世界全体の期待値', '세계 평균 기댓값') }} {{ HDI_EXPECT.toFixed(3) }}</small></div>
      <template v-if="total">
        <div class="tile pick" @click="pick(best)"><span v-fit>{{ L('Best', '最好', '最高', '최고') }}</span><b v-fit class="sm" :style="fit(nameOf(best), 7)"><FlagBall class="fl" :iso="best" />{{ nameOf(best) }}</b><small v-if="SHOW_PRIZE" v-fit :style="{ color: `color-mix(in srgb, ${colorOf(best)} 45%, #ffffff)` }">{{ prizeOf(best) }}</small><small v-else v-fit>{{ hdiWord() }} {{ C[best].hdi.toFixed(3) }}</small></div>
        <div class="tile pick" @click="pick(worst)"><span v-fit>{{ L('Worst', '最差', '最低', '최저') }}</span><b v-fit class="sm" :style="fit(nameOf(worst), 7)"><FlagBall class="fl" :iso="worst" />{{ nameOf(worst) }}</b><small v-if="SHOW_PRIZE" v-fit :style="{ color: `color-mix(in srgb, ${colorOf(worst)} 45%, #ffffff)` }">{{ prizeOf(worst) }}</small><small v-else v-fit>{{ hdiWord() }} {{ C[worst].hdi.toFixed(3) }}</small></div>
      </template>
    </div>

    <template v-if="SHOW_PRIZE">
    <h3>{{ L('Prizes', '獎項', '賞', '상') }}<small>{{ L(`HDI ${meta.hdi.year} · odds vs your draws`, `人類發展指數 ${meta.hdi.year} 年・機率 vs 你抽到的`, `HDI ${meta.hdi.year} 年・確率 vs あなたの結果`, `HDI ${meta.hdi.year}년 · 확률 vs 나의 결과`) }}</small></h3>
    <ol class="prizes">
      <li v-for="(t, i) in TIERS" :key="t.name" :class="{ on: last && tierIdx(last) === i }" :style="{ '--tier': t.color }">
        <div class="p-top">
          <span class="p-name"><i class="sw"></i>{{ t.name }}</span>
          <span class="p-hdi">{{ hdiWord() }} {{ t.range }}</span>
          <span class="p-meta">{{ L(`${t.n} countries · ${t.balls} balls`, `${t.n} 國・${t.balls} 球`, `${t.n} か国・${t.balls} 個`, `${t.n}개국 · 공 ${t.balls}개`) }}</span>
        </div>
        <div class="p-bars">
          <div class="p-bar"><i :style="{ width: `${(pTier(t) / maxTierP) * 100}%` }"></i><b>{{ fmtP(pTier(t)) }}</b><small>{{ L('Odds', '機率', '確率', '확률') }}</small></div>
          <div class="p-bar mine"><i :style="{ width: `${total ? ((drawnByTier[i] || 0) / total / maxTierP) * 100 : 0}%` }"></i><b>{{ total ? fmtP((drawnByTier[i] || 0) / total) : '—' }}</b><small>{{ L(`You: ${drawnByTier[i] || 0}`, `你 ${drawnByTier[i] || 0} 次`, `あなた ${drawnByTier[i] || 0} 回`, `나 ${drawnByTier[i] || 0}번`) }}</small></div>
        </div>
      </li>
    </ol>
    <p class="note">{{ L(`The bigger the prize, the harder it is to win: each tier's odds are kept as close as possible to ${TIER_R}× the tier above (1:2:4:…:128). Countries with no HDI (${noHdi.n} countries, ${noHdi.balls} balls) are redrawn automatically${rerolls ? ` — ${rerolls} redraws so far` : ''}.`, `獎越大越難中：每一級的機率盡量接近上一級的 ${TIER_R} 倍（1:2:4:…:128）。沒有人類發展指數的國家（${noHdi.n} 國、${noHdi.balls} 球）抽到就重抽${rerolls ? `，到目前重抽 ${rerolls} 次` : ''}。`, `大きい賞ほど当たりにくく、各賞の確率はひとつ上の賞のなるべく ${TIER_R} 倍（1:2:4:…:128）。HDI のない国（${noHdi.n} か国・${noHdi.balls} 個）は引き直し${rerolls ? `（これまで ${rerolls} 回）` : ''}。`, `큰 상일수록 당첨되기 어려워요. 각 상의 확률은 바로 위 상의 ${TIER_R}배에 최대한 가깝게 (1:2:4:…:128). HDI가 없는 나라(${noHdi.n}개국, 공 ${noHdi.balls}개)는 다시 뽑아요${rerolls ? ` (지금까지 ${rerolls}번)` : ''}.`) }}</p>
    </template>

    <template v-if="total">
      <h3>{{ L('Most drawn', '最常投胎到', 'よく生まれた国', '가장 많이 태어난 곳') }}</h3>
      <ol class="rows">
        <li v-for="(c, k) in topDrawn" :key="c.iso" :class="{ on: c.iso === last }" @click="pick(c.iso)">
          <span class="r-n">{{ k + 1 }}</span><FlagBall class="fl" :iso="c.iso" />
          <span class="r-name" :style="fit(nameOf(c.iso), R_CAP, 0.6)">{{ nameOf(c.iso) }}<small v-if="SHOW_PRIZE"><i class="sw" :style="{ background: colorOf(c.iso) }"></i>{{ prizeOf(c.iso) }}</small></span>
          <b class="r-v">{{ c.n.toLocaleString('en-US') }}{{ L('×', ' 次', ' 回', '번') }}<small>{{ fmtP(c.n / total) }}</small></b>
        </li>
      </ol>
    </template>

    <div class="h-row">
      <h3>{{ L('All countries', '全部國家', 'すべての国', '모든 나라') }}<small>{{ L(`${meta.count} countries · ${BALL_TOTAL} balls`, `${meta.count} 國・${BALL_TOTAL} 球`, `${meta.count} か国・${BALL_TOTAL} 個`, `${meta.count}개국 · 공 ${BALL_TOTAL}개`) }}</small></h3>
      <div class="seg" role="group" :aria-label="L('Sort', '排序', '並べ替え', '정렬')">
        <button v-for="s in SORTS" :key="s.key" type="button" :class="{ on: sort === s.key }" @click="sort = s.key">{{ s.label }}</button>
      </div>
    </div>
    <ol class="rows">
      <li v-for="(iso, k) in sorted" :key="iso" :class="{ on: iso === last }" @click="pick(iso)">
        <span class="r-n">{{ k + 1 }}</span><FlagBall class="fl" :iso="iso" />
        <span class="r-name" :style="fit(nameOf(iso), R_CAP, 0.6)">{{ nameOf(iso) }}<small><template v-if="SHOW_PRIZE"><i class="sw" :style="{ background: colorOf(iso) }"></i>{{ prizeOf(iso) }}{{ L(' · ', '・', '・', ' · ') }}</template>{{ hdiWord() }} {{ C[iso].hdi?.toFixed(3) ?? '—' }}</small></span>
        <b class="r-v"><em class="r-lbl">{{ L('odds', '機率', '確率', '확률') }}</em>{{ fmtP(mode === 'map' ? C[iso].p : pIso(iso)) }}<small>{{ L(`${BALLS[iso]} ${BALLS[iso] === 1 ? 'ball' : 'balls'}${counts[iso] ? ` · drawn ${counts[iso]}` : ''}`, `${BALLS[iso]} 球${counts[iso] ? `・中 ${counts[iso]}` : ''}`, `${BALLS[iso]} 個${counts[iso] ? `・当選 ${counts[iso]}` : ''}`, `공 ${BALLS[iso]}개${counts[iso] ? ` · 당첨 ${counts[iso]}` : ''}`) }}</small></b>
      </li>
    </ol>
    <p class="note">{{ L(`Taiwan: ${SHOW_PRIZE ? `${prizeOf('TWN')} (HDI ${C.TWN.hdi.toFixed(3)})` : `HDI ${C.TWN.hdi.toFixed(3)}`}, ${BALLS.TWN} balls, odds ${fmtP(pIso('TWN'))} — roughly 1 in every ${oneIn(pIso('TWN'))} babies is born in Taiwan. One ball ≈ ${fmtBig(POP_UNIT)} people.`, `臺灣：${SHOW_PRIZE ? `${prizeOf('TWN')}（人類發展指數 ${C.TWN.hdi.toFixed(3)}）` : `人類發展指數 ${C.TWN.hdi.toFixed(3)}`}，${BALLS.TWN} 顆球，機率 ${fmtP(pIso('TWN'))}，大約每 ${oneIn(pIso('TWN'))} 次投胎才會有一次生在臺灣。1 顆球約 ${fmtBig(POP_UNIT)} 人。`, `台湾：${SHOW_PRIZE ? `${prizeOf('TWN')}（HDI ${C.TWN.hdi.toFixed(3)}）` : `HDI ${C.TWN.hdi.toFixed(3)}`}、ボール ${BALLS.TWN} 個、確率 ${fmtP(pIso('TWN'))}。約 ${oneIn(pIso('TWN'))} 人に 1 人が台湾に生まれる計算です。ボール 1 個 ≈ ${fmtBig(POP_UNIT)} 人。`, `대만: ${SHOW_PRIZE ? `${prizeOf('TWN')} (HDI ${C.TWN.hdi.toFixed(3)})` : `HDI ${C.TWN.hdi.toFixed(3)}`}, 공 ${BALLS.TWN}개, 확률 ${fmtP(pIso('TWN'))}. 약 ${oneIn(pIso('TWN'))}명 중 1명꼴로 대만에서 태어나는 셈이에요. 공 1개 ≈ ${fmtBig(POP_UNIT)}명.`) }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import FlagBall from '../FlagBall.vue'
import { fit } from '../../lib/fit.js'
const R_CAP = 10.5 // 清單的國名放得下幾個全形字（14px）
import { L, isCJK } from '../../i18n.js'
import { meta, C, ISOS, BALLS, BALL_TOTAL, POP_UNIT, TIERS, TIER_R, noHdi, HDI_EXPECT, hdiWord, mode, tierIdx, nameOf, prizeOf, colorOf, pTier, pIso, fmtP, oneIn, fmtBig, SHOW_PRIZE } from '../../lottery.js'
import { counts, total, last, rerolls, drawnMean, best, worst, drawnByTier, topDrawn, pick } from '../../store.js'

const SORTS = [['pop', 'By odds', '照機率', '確率順', '확률순'], ['hdi', 'By HDI', '照指數', 'HDI 順', 'HDI순']].map(([key, ...t]) => ({ key, get label() { return L(...t) } }))
const sort = ref('pop')
const sorted = computed(() => (sort.value === 'pop' ? ISOS : [...ISOS].sort((a, b) => (C[b].hdi ?? -1) - (C[a].hdi ?? -1))))
const maxTierP = Math.max(...TIERS.map((t) => pTier(t)))
</script>
