<template>
  <!-- 結果分頁：這次抽到的票卡；還沒抽／搖獎中顯示提示；最下面是這一頁的操作說明 -->
  <section>
    <template v-if="last && !spinning && tierIdx(last) >= 0">
      <!-- 結果票卡：跟舞台上的中獎看板同一套樣式 -->
      <ResultBoard ticket :iso="last" :title="L(`DRAW #${(lastN ?? total).toLocaleString('en-US')} · YOU WERE BORN IN`, `第 ${(lastN ?? total).toLocaleString('en-US')} 次投胎・你出生在`, `${(lastN ?? total).toLocaleString('en-US')} 回目の国ガチャ・あなたの生まれは`, `${(lastN ?? total).toLocaleString('en-US')}번째 뽑기 · 당신이 태어난 곳은`)">
        <div class="tiles">
          <div class="tile dot"><i class="hdi-dot" :style="{ background: hdiColor(last) }"></i><span v-fit>{{ hdiWord() }}</span><b v-fit>{{ C[last].hdi.toFixed(3) }}</b><small v-fit>{{ rankText(last) }}</small></div>
          <div v-if="SHOW_PRIZE" class="tile"><span v-fit>{{ L('HDI of this prize', '此獎人類發展指數', 'この賞の HDI', '이 상의 HDI') }}</span><b v-fit>{{ TIERS[tierIdx(last)].range }}</b><small v-fit>{{ TIERS[tierIdx(last)].name }}</small></div>
          <div v-if="SHOW_PRIZE" class="tile"><span v-fit>{{ L('Odds of winning this prize', '抽到此獎機率', 'この賞が当たる確率', '이 상에 당첨될 확률') }}</span><b v-fit>{{ fmtP(pTier(TIERS[tierIdx(last)])) }}</b><small v-fit>{{ L(`About 1 in ${oneIn(pTier(TIERS[tierIdx(last)]))}`, `約 1/${oneIn(pTier(TIERS[tierIdx(last)]))}`, `約 ${oneIn(pTier(TIERS[tierIdx(last)]))} 分の 1`, `약 ${oneIn(pTier(TIERS[tierIdx(last)]))}분의 1`) }}</small></div>
          <div class="tile"><span v-fit>{{ L('Odds of drawing this country', '抽到此國機率', 'この国が当たる確率', '이 나라가 뽑힐 확률') }}</span><b v-fit>{{ fmtP(pIso(last)) }}</b><small v-fit>{{ L(`About 1 in ${oneIn(pIso(last))}`, `約 1/${oneIn(pIso(last))}`, `約 ${oneIn(pIso(last))} 分の 1`, `약 ${oneIn(pIso(last))}분의 1`) }}</small></div>
          <div v-if="lastBall != null" class="tile"><span v-fit>{{ L('Ball', '球號', 'ボール番号', '공 번호') }}</span><b v-fit>#{{ (lastBall + 1).toLocaleString('en-US') }}</b><small v-fit>{{ L(`${BALLS[last]} of ${BALL_TOTAL} balls`, `這國 ${BALLS[last]} 顆／共 ${BALL_TOTAL} 顆`, `この国 ${BALLS[last]} 個／全 ${BALL_TOTAL} 個`, `이 나라 ${BALLS[last]}개 / 총 ${BALL_TOTAL}개`) }}</small></div>
          <div class="tile" :class="{ wide: lastBall == null }"><span v-fit>{{ L('Population', '人口', '人口', '인구') }}</span><b v-fit>{{ fmtBig(C[last].pop) }}</b><small v-fit>{{ C[last].pop_date }}</small></div>
        </div>
        <p v-if="lastRerolls" class="note">{{ L(`${lastRerolls} redraw ${lastRerolls > 1 ? 'balls' : 'ball'} (${noHdiNames()}) dropped first, so it was drawn again automatically.`, `先掉出 ${lastRerolls} 次重抽球（${noHdiNames()}），自動再搖`, `先に引き直しボール（${noHdiNames()}）が ${lastRerolls} 回出たので、自動でもう一度回しました。`, `다시 뽑기 공(${noHdiNames()})이 먼저 ${lastRerolls}번 나와서 자동으로 다시 돌렸어요.`) }}</p>
      </ResultBoard>
    </template>
    <div v-else class="empty">
      <div class="e-ball" :class="{ spin: spinning }"></div>
      <p v-if="spinning" class="e-main">{{ L('Drawing… waiting for a ball to drop', '搖獎中…等球掉進盤子', '抽選中…ボールが受け皿に落ちるのを待っています', '추첨 중… 공이 쟁반에 떨어지길 기다리는 중') }}</p>
      <template v-else>
        <p class="e-main">{{ L('Press', '按', '', '') }} <b class="kbd">{{ L('SPIN', '搖一搖', '回す', '돌리기') }}</b> {{ L('to be born', '開始投胎', 'を押して生まれよう', '를 눌러 태어나 보세요') }}</p>
        <p v-if="mode === 'game'" class="e-sub">{{ L(`Which of the ${BALL_TOTAL} balls drops out is decided entirely by the physics simulation. Odds = that country's balls ÷ all balls.`, `${BALL_TOTAL} 顆球裡掉出哪一顆，全部照物理模擬決定；抽中的機率＝那一國的球數 ÷ 全部球數。`, `${BALL_TOTAL} 個のボールのどれが出るかは、すべて物理シミュレーションで決まります。当たる確率＝その国のボール数 ÷ 全ボール数。`, `${BALL_TOTAL}개 공 중 어느 공이 나올지는 전부 물리 시뮬레이션으로 정해져요. 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수.`) }}</p>
        <p v-else-if="mode === 'map'" class="e-sub">{{ L(`Odds = that country's population ÷ world population. Turn on “Draws” to circle the countries you've drawn; each circle's area is its share of your draws.`, '抽中的機率＝那一國的人口 ÷ 全世界人口。打開「抽過的」會在抽過的國家畫金色圓，面積＝抽中次數佔幾成。', '当たる確率＝その国の人口 ÷ 世界の人口。「当たった国」をオンにすると、当たった国に金色の円を描きます（面積＝当選回数の割合）。', '뽑힐 확률 = 그 나라 인구 ÷ 세계 인구. 「뽑힌 나라」를 켜면 뽑힌 나라에 금색 원을 그려요 (면적 = 뽑힌 횟수의 비율).') }}</p>
        <p v-else class="e-sub">{{ L(`One ball is drawn from ${BALL_TOTAL}. Odds = that country's balls ÷ all balls.`, `從 ${BALL_TOTAL} 顆球裡抽一顆：抽中的機率＝那一國的球數 ÷ 全部球數。`, `${BALL_TOTAL} 個のボールから 1 個を引きます。当たる確率＝その国のボール数 ÷ 全ボール数。`, `${BALL_TOTAL}개 공 중 하나를 뽑아요. 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수.`) }}</p>
      </template>
    </div>
    <p class="hint"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>{{ L(...HINTS[mode]) }}</p>
  </section>
</template>

<script setup>
import ResultBoard from '../ResultBoard.vue'
import { L } from '../../i18n.js'
import { C, hdiColor, BALLS, BALL_TOTAL, TIERS, hdiWord, rankText, mode, tierIdx, noHdiNames, pTier, pIso, fmtP, oneIn, fmtBig, SHOW_PRIZE } from '../../lottery.js'
import { last, lastBall, lastN, lastRerolls, spinning, total } from '../../store.js'

// 最下面的操作提示（[英文, 中文, 日文, 韓文]）
const HINTS = {
  game: ['Shake your phone to spin too. Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '搖一搖手機也能開始搖獎。左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', 'スマホを振っても回せます。左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '휴대폰을 흔들어도 돌릴 수 있어요. 좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
  map: ['Drag and pinch to move the map; tap a country to see its odds and HDI.', '拖曳、兩指縮放地圖；點一個國家看機率和人類發展指數。', 'ドラッグ・2 本指で地図を動かせます。国をタップすると確率と HDI を表示。', '드래그·두 손가락으로 지도를 움직여요. 나라를 탭하면 확률과 HDI가 보여요.'],
  box: ['Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', '左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
  boxp: ['Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', '左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
}
</script>
