<template>
  <!-- 出生搖搖樂（手機版）：整個畫面就是舞台（預設 3D 樂透搖獎機），下面浮著一條玻璃操作列：模式選單（漢堡）、DRAW、資訊；
       結果、歷史、獎項（含統計）、說明收在從下面拉上來的面板（按資訊或點結果卡打開）
       舞台蓋滿整個畫面（含狀態列、操作列後面）；insets＝上面狀態列、下面操作列擋住的高度，傳給各模式把內容放在看得到的地方
       手機、iPad 滿版；電腦上照直式手機比例置中 -->
  <div ref="phoneEl" class="phone">
    <i ref="safeTopEl" class="safe-top" aria-hidden="true"></i>
    <div class="stage-wrap">
    <Transition name="fade">
      <div v-if="!atlas" class="loading">
        <!-- 載入畫面：中、日、韓、英四種語言都寫（還不知道使用者看哪一種）；跟主畫面同一套霓虹招牌 -->
        <div class="ld-ball"><i></i></div>
        <div class="ld-sign">
          <div class="ld-row"><span class="n-pink">出生</span><span class="n-cyan">搖搖樂</span></div>
          <div class="ld-row ja"><span class="n-pink">出生</span><span class="n-cyan">ガチャ</span></div>
          <div class="ld-row ko"><span class="n-pink">출생</span> <span class="n-cyan">복권</span></div>
          <div class="ld-row en"><span class="n-pink">BIRTH</span> <span class="n-cyan">LOTTERY</span></div>
        </div>
        <div class="ld-sub"><span>載入中</span><i>◆</i><span>読み込み中</span><i>◆</i><span>로딩 중</span><i>◆</i><span>Loading</span></div>
        <div class="ld-dots"><i></i><i></i><i></i></div>
      </div>
    </Transition>
    <LotteryDrum ref="drum" :balls="balls" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]" v-if="atlas" :paused="mode !== 'game'"
      :face="face" :sel="lastBall" :tip-of="ballTip" :party="spinning ? 0 : total" :spinning="spinning" :inset-top="topInset" :inset-bottom="insets.bottom">
      <!-- 抽完在搖獎機下面顯示結果看板（國旗、英文國名、獎牌）；點了打開結果面板 -->
      <Transition name="board">
        <div v-if="last && !spinning && lastBall != null" :key="total" class="rb-wrap" :style="{ '--tier': colorOf(last) }" @click="openSheet('result')">
          <i v-for="k in 8" :key="k" class="rb-star" :class="`s${k}`">✦</i>
          <div class="result-board">
            <div class="rb-bulbs"></div>
            <div class="rb-shine"></div>
            <div class="rb-body">
              <!-- 國旗球：兩面國旗並排成一條帶子，往左捲動，看起來像球在水平轉 -->
              <div class="rb-ball"><div class="rb-flag"><div class="rb-roll"><i :style="flagStyle(last)"></i><i :style="flagStyle(last)"></i></div></div></div>
              <div class="rb-main"><div class="rb-name">{{ nameOf(last) }}</div></div>
              <div class="rb-medal">
                <i class="md-tail l"></i><i class="md-tail r"></i>
                <div class="md-coin">
                  <div class="md-face" :class="{ long: tierShort(tierIdx(last)).length > (isCJK() ? 2 : 3) }">
                    <b>{{ tierShort(tierIdx(last)) }}</b><small v-if="!isCJK()">PRIZE</small>
                  </div>
                </div>
              </div>
            </div>
            <WorldLocator compact class="rb-map" :iso="last" :color="colorOf(last)" />
          </div>
        </div>
      </Transition>
    </LotteryDrum>

    </div>

    <!-- 中／英切換：畫面最上面右邊（預設中文，選過的記在瀏覽器） -->
    <div class="lang-switch glass" role="group" aria-label="Language / 語言" :style="{ top: `${insets.top + 8}px` }">
      <button v-for="[k, label] in LANGS" :key="k" type="button" :class="{ on: lang === k }" :aria-pressed="lang === k" @click="setLang(k)">{{ label }}</button>
    </div>
    <!-- 頁面名稱＋模式選單（漢堡合在一起）：最上面左邊寫這是哪一頁，按下去往下展開選單 -->
    <div v-if="menu" class="menu-scrim" @click="menu = false"></div>
    <nav class="modes" :style="{ top: `${insets.top + 8}px` }" :aria-label="L('Modes', '模式', 'モード', '모드')">
      <button type="button" class="mode-title" :class="{ on: menu }" :aria-expanded="menu" :aria-label="L('Switch mode', '切換模式', 'モード切替', '모드 전환')" :disabled="spinning" @click="menu = !menu">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path :d="menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
        <span>{{ modeLabel }}</span>
      </button>
      <Transition name="menu">
        <ul v-if="menu" class="menu glass" role="menu">
          <li v-for="m in MODES" :key="m.key">
            <button type="button" role="menuitemradio" :aria-checked="mode === m.key" :class="{ on: mode === m.key }" @click="setMode(m.key); menu = false">
              <i class="m-dot"></i>{{ m.label }}
            </button>
          </li>
          <li class="m-sep" role="separator"></li>
          <li>
            <button type="button" role="menuitem" @click="menu = false; openSheet()">
              <svg class="m-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>{{ L('Results & info', '結果與說明', '結果と説明', '결과와 설명') }}
              <span v-if="total" class="m-badge">{{ total > 99 ? '99+' : total }}</span>
            </button>
          </li>
        </ul>
      </Transition>
    </nav>
    <!-- 操作列：浮在舞台上的玻璃條；只有 DRAW（所有模式共用，唯一的抽獎按鈕）；資訊在左上的選單裡 -->
    <div ref="dockEl" class="dock">
      <button type="button" class="draw" :class="{ busy: spinning }" :disabled="spinning || !atlas" @click="draw">
        <i class="d-bulbs" aria-hidden="true"></i>
        <span class="d-dome"><i v-if="!spinning" class="d-star" aria-hidden="true">★</i><b :aria-label="spinning ? L('SPINNING', '搖獎中', '抽選中', '추첨 중') : L('SPIN', '搖一搖', '回す', '돌리기')"><span v-for="(ch, i) in [...(spinning ? L('SPINNING', '搖獎中', '抽選中', '추첨 중') : L('SPIN', '搖一搖', '回す', '돌리기'))]" :key="`${spinning}${i}`" class="d-ch" :style="{ '--i': i }" aria-hidden="true">{{ ch }}</span></b><i v-if="!spinning" class="d-star r" aria-hidden="true">★</i><i v-if="spinning" class="d-dots"><i></i><i></i><i></i></i></span>
      </button>
    </div>

    <!-- 遊戲以外的頁面（地圖、彩球盒）：跟資訊面板一樣從下面拉上來，蓋住搖獎機和操作列（搖一搖只在遊戲頁）；點外面、按 ✕、往下滑回到遊戲 -->
    <Transition name="fade"><div v-if="atlas && mode !== 'game'" class="scrim view-scrim" @click="setMode('game')"></div></Transition>
    <Transition name="sheet">
    <aside v-if="atlas && mode !== 'game'" class="sheet view-sheet" role="dialog" :aria-label="modeLabel" :style="dragFor === 'view' && dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : null">
      <div class="sheet-head" data-s="view" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
        <i class="grip"></i>
        <div class="sh-row">
          <h2 class="vs-title">{{ modeLabel }}</h2>
          <button v-if="mode === 'map'" type="button" class="pill vs-reset vs-tog" :class="{ off: !showTally }" :aria-pressed="showTally" @click="showTally = !showTally">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2.2" fill="none" /><circle cx="12" cy="12" r="2.4" fill="currentColor" /></svg>{{ L('Draws', '抽過的', '当選済み', '뽑힌 곳') }}
          </button>
          <button type="button" class="pill vs-reset" @click="(mode === 'map' ? mapEl : boxEl)?.resetView()">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>{{ L('RESET', '重設', 'リセット', '초기화') }}
          </button>
          <button type="button" class="close" :aria-label="L('Close', '關閉', '閉じる', '닫기')" @click="setMode('game')">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
          </button>
        </div>
      </div>
      <div class="vs-body">
        <MapModes v-if="mode === 'map'" ref="mapEl" :show-tally="showTally" :face="face" :last="last" :last-ball="lastBall" :counts="counts" :total="total" :atlas="atlas" :inset-top="0" :inset-bottom="safeBottom" />
        <LotteryBox v-else ref="boxEl" :key="mode" :balls="balls" :cells="mode === 'boxp' ? boxRank.cells : cellsSnap" :cols="cellMeta.cols" :rows="cellMeta.rows"
          :walls="mode === 'boxp' ? boxRank.walls : []" :frames="mode === 'boxp' ? boxRank.frames : []" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]"
          :face="face" :sel="lastBall" :tip-of="ballTip" bg="#0d0926" :inset-top="0" :inset-bottom="safeBottom" />
      </div>
    </aside>
    </Transition>

    <!-- 資訊面板：從下面拉上來，蓋在舞台上；點外面、按 ✕、往下滑都會收起來 -->
    <Transition name="fade"><div v-if="sheet" class="scrim" @click="sheet = false"></div></Transition>
    <Transition name="sheet">
    <aside v-if="sheet" class="sheet" role="dialog" :aria-label="L('Info', '資訊', '情報', '정보')" :style="dragFor === 'info' && dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : null">
    <div class="sheet-head" data-s="info" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
      <i class="grip"></i>
      <div class="sh-row">
        <nav class="tabs" role="tablist">
          <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
        </nav>
        <button type="button" class="close" :aria-label="L('Close', '關閉', '閉じる', '닫기')" @click="sheet = false">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
        </button>
      </div>
    </div>

    <main class="content">
      <!-- 結果 -->
      <section v-if="tab === 'result'">
        <template v-if="last && !spinning && tierIdx(last) >= 0">
          <!-- 結果票卡：跟舞台上的中獎看板同一套樣式（燈泡框、斜體描邊國名、轉動的國旗球、斜貼獎牌），文字全英文 -->
          <article class="result-board t-board" :style="{ '--tier': colorOf(last) }">
            <div class="rb-bulbs"></div>
            <div class="rb-shine"></div>
            <div class="rb-medal t-medal">
              <i class="md-tail l"></i><i class="md-tail r"></i>
              <div class="md-coin">
                <div class="md-face" :class="{ long: tierShort(tierIdx(last)).length > (isCJK() ? 2 : 3) }">
                  <b>{{ tierShort(tierIdx(last)) }}</b><small v-if="!isCJK()">PRIZE</small>
                </div>
              </div>
            </div>
            <div class="rb-body t-body">
              <div class="rb-ball"><div class="rb-flag"><div class="rb-roll"><i :style="flagStyle(last)"></i><i :style="flagStyle(last)"></i></div></div></div>
              <div class="rb-main"><div class="t-title">{{ L(`DRAW #${total.toLocaleString('en-US')} · YOU WERE BORN IN`, `第 ${total.toLocaleString('en-US')} 次投胎・你出生在`, `${total.toLocaleString('en-US')} 回目の転生・あなたが生まれたのは`, `${total.toLocaleString('en-US')}번째 환생 · 당신이 태어난 곳은`) }}</div><div class="rb-name">{{ nameOf(last) }}</div></div>
            </div>
            <WorldLocator compact class="t-map" :iso="last" :color="colorOf(last)" />
            <div class="tiles">
              <div class="tile"><span>HDI</span><b>{{ C[last].hdi.toFixed(3) }}</b><small>{{ C[last].hdi_rank ? L(`UNDP rank #${C[last].hdi_rank}`, `UNDP 第 ${C[last].hdi_rank} 名`, `UNDP ${C[last].hdi_rank} 位`, `UNDP ${C[last].hdi_rank}위`) : L('Not ranked by UNDP', '不在 UNDP 排名', 'UNDP 順位なし', 'UNDP 순위 없음') }}</small></div>
              <div class="tile"><span>{{ L('HDI of this prize', '這一獎的 HDI', 'この賞の HDI', '이 상의 HDI') }}</span><b>{{ TIERS[tierIdx(last)].range }}</b><small>{{ TIERS[tierIdx(last)].name }}</small></div>
              <div class="tile"><span>{{ L('Odds of this prize', '這一獎的機率', 'この賞の確率', '이 상의 확률') }}</span><b>{{ fmtP(pTier(TIERS[tierIdx(last)])) }}</b><small>{{ L(`About 1 in ${oneIn(pTier(TIERS[tierIdx(last)]))}`, `約 1/${oneIn(pTier(TIERS[tierIdx(last)]))}`, `約 ${oneIn(pTier(TIERS[tierIdx(last)]))} 分の 1`, `약 ${oneIn(pTier(TIERS[tierIdx(last)]))}분의 1`) }}</small></div>
              <div class="tile"><span>{{ L('Odds of this country', '這一國的機率', 'この国の確率', '이 나라의 확률') }}</span><b>{{ fmtP(pIso(last)) }}</b><small>{{ L(`About 1 in ${oneIn(pIso(last))}`, `約 1/${oneIn(pIso(last))}`, `約 ${oneIn(pIso(last))} 分の 1`, `약 ${oneIn(pIso(last))}분의 1`) }}</small></div>
              <div v-if="lastBall != null" class="tile"><span>{{ L('Ball', '球號', 'ボール番号', '공 번호') }}</span><b>#{{ (lastBall + 1).toLocaleString('en-US') }}</b><small>{{ L(`${BALLS[last]} of ${BALL_TOTAL} balls`, `這國 ${BALLS[last]} 顆／共 ${BALL_TOTAL} 顆`, `この国 ${BALLS[last]} 個／全 ${BALL_TOTAL} 個`, `이 나라 ${BALLS[last]}개 / 총 ${BALL_TOTAL}개`) }}</small></div>
              <div class="tile" :class="{ wide: lastBall == null }"><span>{{ L('Population', '人口', '人口', '인구') }}</span><b>{{ fmtBig(C[last].pop) }}</b><small>{{ C[last].pop_date }}</small></div>
            </div>
            <p v-if="lastRerolls" class="note">{{ L(`${lastRerolls} redraw ${lastRerolls > 1 ? 'balls' : 'ball'} (${noHdiNames()}) dropped first, so it was drawn again automatically.`, `先掉出 ${lastRerolls} 次重抽球（${noHdiNames()}），自動再搖`, `先に引き直しボール（${noHdiNames()}）が ${lastRerolls} 回出たので、自動でもう一度回しました。`, `다시 뽑기 공(${noHdiNames()})이 먼저 ${lastRerolls}번 나와서 자동으로 다시 돌렸어요.`) }}</p>
          </article>
        </template>
        <div v-else class="empty">
          <div class="e-ball" :class="{ spin: spinning }"></div>
          <p v-if="spinning" class="e-main">{{ L('Drawing… waiting for a ball to drop', '搖獎中…等球掉進盤子', '抽選中…ボールがトレーに落ちるのを待っています', '추첨 중… 공이 쟁반에 떨어지길 기다리는 중') }}</p>
          <template v-else>
            <p class="e-main">{{ L('Press', '按', '', '') }} <b class="kbd">{{ L('SPIN', '搖一搖', '回す', '돌리기') }}</b> {{ L('to be born', '開始投胎', 'を押して生まれよう', '를 눌러 태어나기') }}</p>
            <p v-if="mode === 'game'" class="e-sub">{{ L(`Which of the ${BALL_TOTAL} balls drops out is decided entirely by the physics simulation. Odds = that country's balls ÷ all balls.`, `${BALL_TOTAL} 顆球裡掉出哪一顆，全部照物理模擬決定；抽中的機率＝那一國的球數 ÷ 全部球數。`, `${BALL_TOTAL} 個のボールのどれが出るかは、すべて物理シミュレーションで決まります。当たる確率＝その国のボール数 ÷ 全ボール数。`, `${BALL_TOTAL}개 공 중 어느 공이 나올지는 전부 물리 시뮬레이션으로 정해져요. 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수.`) }}</p>
            <p v-else-if="mode === 'map'" class="e-sub">{{ L(`Odds = that country's population ÷ world population. Turn on “Draws” to circle the countries you've drawn; each circle's area is its share of your draws.`, '抽中的機率＝那一國的人口 ÷ 全世界人口。打開「抽過的」會在抽過的國家畫金色圓，面積＝抽中次數佔幾成。', '当たる確率＝その国の人口 ÷ 世界の人口。「当選済み」をオンにすると、当たった国に金色の円を描きます（面積＝当選回数の割合）。', '뽑힐 확률 = 그 나라 인구 ÷ 세계 인구. 「뽑힌 곳」을 켜면 뽑힌 나라에 금색 원을 그려요 (면적 = 뽑힌 횟수의 비율).') }}</p>
            <p v-else class="e-sub">{{ L(`One ball is drawn from ${BALL_TOTAL}. Odds = that country's balls ÷ all balls.`, `從 ${BALL_TOTAL} 顆球裡抽一顆：抽中的機率＝那一國的球數 ÷ 全部球數。`, `${BALL_TOTAL} 個のボールから 1 個を引きます。当たる確率＝その国のボール数 ÷ 全ボール数。`, `${BALL_TOTAL}개 공 중 하나를 뽑아요. 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수.`) }}</p>
          </template>
        </div>
        <p class="hint"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>{{ L(...HINTS[mode]) }}</p>
      </section>

      <!-- 歷史：抽過的結果，新的在上面 -->
      <section v-else-if="tab === 'history'">
        <div class="h-row">
          <h3>{{ L('Draw history', '抽過的結果', '抽選の履歴', '뽑기 기록') }}<small>{{ L(`${total.toLocaleString('en-US')} ${total === 1 ? 'draw' : 'draws'} · newest first`, `共 ${total.toLocaleString('en-US')} 次・新的在上面`, `全 ${total.toLocaleString('en-US')} 回・新しい順`, `총 ${total.toLocaleString('en-US')}번 · 최신순`) }}</small></h3>
          <button v-if="history.length" type="button" class="pill clear" :disabled="spinning" @click="clearHistory">{{ L('Clear', '清空', 'クリア', '지우기') }}</button>
        </div>
        <ol v-if="history.length" class="rows">
          <li v-for="h in historyDesc" :key="h.n" :class="{ on: h.n === total }" @click="pick(h.iso)">
            <span class="r-n">{{ h.n }}</span><FlagBall class="fl" :iso="h.iso" />
            <span class="r-name">{{ nameOf(h.iso) }}<small><i class="sw" :style="{ background: colorOf(h.iso) }"></i>{{ prizeOf(h.iso) }}{{ L(' · ', '・', '・', ' · ') }}HDI {{ C[h.iso].hdi?.toFixed(3) ?? '—' }}</small></span>
            <b class="r-v">{{ h.time }}<small v-if="h.ball != null">#{{ h.ball + 1 }}</small></b>
          </li>
        </ol>
        <div v-else class="card empty"><p class="e-main">{{ L('No draws yet', '還沒抽過', 'まだ抽選していません', '아직 뽑지 않았어요') }}</p><p class="e-sub">{{ L('Press SPIN and every result will be listed here.', '按「搖一搖」抽一次，結果會一筆一筆記在這裡。', '「回す」を押すと、結果がここに記録されます。', '「돌리기」를 누르면 결과가 여기에 기록돼요.') }}</p></div>
      </section>

      <!-- 獎項＋統計：上面是你抽的成績，中間每一獎的「應該中幾成 vs 你中幾成」，下面全部國家 -->
      <section v-else-if="tab === 'prize'">
        <h3>{{ L('Your results', '你的成績', 'あなたの成績', '나의 성적') }}</h3>
        <div class="tiles">
          <div class="tile"><span>{{ L('Draws', '已抽', '抽選回数', '뽑은 횟수') }}</span><b>{{ total.toLocaleString('en-US') }}<em v-if="isCJK()">{{ L('', '次', '回', '번') }}</em></b><small>{{ L(`${Object.keys(counts).length} ${Object.keys(counts).length === 1 ? 'country' : 'countries'}${rerolls ? ` · ${rerolls} redrawn` : ''}`, `抽到 ${Object.keys(counts).length} 國${rerolls ? `・重抽 ${rerolls}` : ''}`, `${Object.keys(counts).length} か国${rerolls ? `・引き直し ${rerolls}` : ''}`, `${Object.keys(counts).length}개국${rerolls ? ` · 다시 뽑기 ${rerolls}` : ''}`) }}</small></div>
          <div class="tile"><span>{{ L('Average HDI', '平均 HDI', '平均 HDI', '평균 HDI') }}</span><b>{{ total ? drawnMean.toFixed(3) : '—' }}</b><small>{{ L('World expectation', '全世界期望', '世界の期待値', '세계 기댓값') }} {{ HDI_EXPECT.toFixed(3) }}</small></div>
          <template v-if="total">
            <div class="tile pick" @click="pick(best)"><span>{{ L('Best', '最好', '最高', '최고') }}</span><b class="sm"><FlagBall class="fl" :iso="best" />{{ nameOf(best) }}</b><small :style="{ color: `color-mix(in srgb, ${colorOf(best)} 45%, #ffffff)` }">{{ prizeOf(best) }}</small></div>
            <div class="tile pick" @click="pick(worst)"><span>{{ L('Worst', '最差', '最低', '최저') }}</span><b class="sm"><FlagBall class="fl" :iso="worst" />{{ nameOf(worst) }}</b><small :style="{ color: `color-mix(in srgb, ${colorOf(worst)} 45%, #ffffff)` }">{{ prizeOf(worst) }}</small></div>
          </template>
        </div>

        <h3>{{ L('Prizes', '獎項', '賞', '상') }}<small>{{ L(`HDI ${meta.hdi.year} · odds vs your draws`, `HDI ${meta.hdi.year} 年・機率 vs 你抽到的`, `HDI ${meta.hdi.year} 年・確率 vs あなたの結果`, `HDI ${meta.hdi.year}년 · 확률 vs 나의 결과`) }}</small></h3>
        <ol class="prizes">
          <li v-for="(t, i) in TIERS" :key="t.name" :class="{ on: last && tierIdx(last) === i }" :style="{ '--tier': t.color }">
            <div class="p-top">
              <span class="p-name"><i class="sw"></i>{{ t.name }}</span>
              <span class="p-hdi">HDI {{ t.range }}</span>
              <span class="p-meta">{{ L(`${t.n} countries · ${t.balls} balls`, `${t.n} 國・${t.balls} 球`, `${t.n} か国・${t.balls} 個`, `${t.n}개국 · 공 ${t.balls}개`) }}</span>
            </div>
            <div class="p-bars">
              <div class="p-bar"><i :style="{ width: `${(pTier(t) / maxTierP) * 100}%` }"></i><b>{{ fmtP(pTier(t)) }}</b><small>{{ L('Odds', '機率', '確率', '확률') }}</small></div>
              <div class="p-bar mine"><i :style="{ width: `${total ? ((drawnByTier[i] || 0) / total / maxTierP) * 100 : 0}%` }"></i><b>{{ total ? fmtP((drawnByTier[i] || 0) / total) : '—' }}</b><small>{{ L(`You: ${drawnByTier[i] || 0}`, `你 ${drawnByTier[i] || 0} 次`, `あなた ${drawnByTier[i] || 0} 回`, `나 ${drawnByTier[i] || 0}번`) }}</small></div>
            </div>
          </li>
        </ol>
        <p class="note">{{ L(`The bigger the prize, the harder it is to win: each tier's odds are kept as close as possible to ${TIER_R}× the tier above (1:2:4:…:128). Countries with no HDI (${noHdi.n} countries, ${noHdi.balls} balls) are redrawn automatically${rerolls ? ` — ${rerolls} redraws so far` : ''}.`, `獎越大越難中：每一級的機率盡量接近上一級的 ${TIER_R} 倍（1:2:4:…:128）。沒有 HDI 的國家（${noHdi.n} 國、${noHdi.balls} 球）抽到就重抽${rerolls ? `，到目前重抽 ${rerolls} 次` : ''}。`, `大きい賞ほど当たりにくく、各賞の確率はひとつ上の賞のなるべく ${TIER_R} 倍（1:2:4:…:128）。HDI のない国（${noHdi.n} か国・${noHdi.balls} 個）は引き直し${rerolls ? `（これまで ${rerolls} 回）` : ''}。`, `큰 상일수록 당첨되기 어려워요. 각 상의 확률은 바로 위 상의 ${TIER_R}배에 최대한 가깝게 (1:2:4:…:128). HDI가 없는 나라(${noHdi.n}개국, 공 ${noHdi.balls}개)는 다시 뽑아요${rerolls ? ` (지금까지 ${rerolls}번)` : ''}.`) }}</p>

        <template v-if="total">
          <h3>{{ L('Most drawn', '最常投胎到', 'よく生まれた国', '가장 많이 태어난 곳') }}</h3>
          <ol class="rows">
            <li v-for="(c, k) in topDrawn" :key="c.iso" :class="{ on: c.iso === last }" @click="pick(c.iso)">
              <span class="r-n">{{ k + 1 }}</span><FlagBall class="fl" :iso="c.iso" />
              <span class="r-name">{{ nameOf(c.iso) }}<small><i class="sw" :style="{ background: colorOf(c.iso) }"></i>{{ prizeOf(c.iso) }}</small></span>
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
            <span class="r-name">{{ nameOf(iso) }}<small><i class="sw" :style="{ background: colorOf(iso) }"></i>{{ prizeOf(iso) }}{{ L(' · ', '・', '・', ' · ') }}HDI {{ C[iso].hdi?.toFixed(3) ?? '—' }}</small></span>
            <b class="r-v"><em class="r-lbl">{{ L('odds', '機率', '確率', '확률') }}</em>{{ fmtP(mode === 'map' ? C[iso].p : pIso(iso)) }}<small>{{ L(`${BALLS[iso]} ${BALLS[iso] === 1 ? 'ball' : 'balls'}${counts[iso] ? ` · drawn ${counts[iso]}` : ''}`, `${BALLS[iso]} 球${counts[iso] ? `・中 ${counts[iso]}` : ''}`, `${BALLS[iso]} 個${counts[iso] ? `・当選 ${counts[iso]}` : ''}`, `공 ${BALLS[iso]}개${counts[iso] ? ` · 당첨 ${counts[iso]}` : ''}`) }}</small></b>
          </li>
        </ol>
        <p class="note">{{ L(`Taiwan: ${prizeOf('TWN')} (HDI ${C.TWN.hdi.toFixed(3)}), ${BALLS.TWN} balls, odds ${fmtP(pIso('TWN'))} — about 1 birth in ${oneIn(pIso('TWN'))} lands in Taiwan. One ball ≈ ${fmtBig(POP_UNIT)} people.`, `臺灣：${prizeOf('TWN')}（HDI ${C.TWN.hdi.toFixed(3)}），${BALLS.TWN} 顆球，機率 ${fmtP(pIso('TWN'))}，大約 ${oneIn(pIso('TWN'))} 次投胎才會出生在臺灣一次。1 顆球約 ${fmtBig(POP_UNIT)} 人。`, `台湾：${prizeOf('TWN')}（HDI ${C.TWN.hdi.toFixed(3)}）、ボール ${BALLS.TWN} 個、確率 ${fmtP(pIso('TWN'))}。約 ${oneIn(pIso('TWN'))} 回の転生で 1 回だけ台湾に生まれます。ボール 1 個 ≈ ${fmtBig(POP_UNIT)} 人。`, `대만: ${prizeOf('TWN')} (HDI ${C.TWN.hdi.toFixed(3)}), 공 ${BALLS.TWN}개, 확률 ${fmtP(pIso('TWN'))}. 약 ${oneIn(pIso('TWN'))}번 환생해야 한 번 대만에서 태어나요. 공 1개 ≈ ${fmtBig(POP_UNIT)}명.`) }}</p>
      </section>

      <!-- 說明 -->
      <section v-else>
        <h3>{{ L('How it works', '計算方法', 'しくみ', '계산 방법') }}</h3>
        <!-- 三個步驟，寫給國高中生看得懂 -->
        <ol v-if="lang === 'zh'" class="steps">
          <li><b>把全世界的人換成彩球</b>每 {{ fmtBig(POP_UNIT) }} 個人做成 1 顆球；人很少的國家也至少給 1 顆，所以總共 {{ BALL_TOTAL }} 顆。例如印度人最多，有 {{ BALLS.IND }} 顆；臺灣有 {{ BALLS.TWN }} 顆。</li>
          <li><b>隨便抽一顆球</b>抽到某一國的機率＝那一國的球數 ÷ 全部的球數。例如臺灣：{{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}，大約每 {{ oneIn(pIso('TWN')) }} 次才會抽到一次。</li>
          <li><b>看那一國的 HDI，決定中幾獎</b>HDI（人類發展指數）是 0 到 1 的分數，把平均壽命、受教育的年數、收入加在一起算，越接近 1 代表生活條件越好。HDI 越高獎越大，但這種國家人口少，所以越難抽到。</li>
        </ol>
        <ol v-else-if="lang === 'ja'" class="steps">
          <li><b>世界中の人をボールにする</b>{{ fmtBig(POP_UNIT) }} 人ごとにボールを 1 個作ります。人口がとても少ない国にも最低 1 個あげるので、全部で {{ BALL_TOTAL }} 個。いちばん人口が多いインドは {{ BALLS.IND }} 個、台湾は {{ BALLS.TWN }} 個です。</li>
          <li><b>ボールを 1 個引く</b>ある国が当たる確率＝その国のボール数 ÷ 全部のボール数。たとえば台湾は {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}、だいたい {{ oneIn(pIso('TWN')) }} 回に 1 回です。</li>
          <li><b>その国の HDI で賞が決まる</b>HDI（人間開発指数）は 0〜1 の点数で、平均寿命・教育を受けた年数・収入をまとめて計算します。1 に近いほど暮らしやすい国。HDI が高いほど大きな賞ですが、そういう国は人口が少ないので当たりにくいのです。</li>
        </ol>
        <ol v-else-if="lang === 'ko'" class="steps">
          <li><b>세계 사람들을 공으로 바꾸기</b>{{ fmtBig(POP_UNIT) }}명마다 공 1개를 만들어요. 인구가 아주 적은 나라도 최소 1개를 주니까 모두 {{ BALL_TOTAL }}개예요. 인구가 가장 많은 인도는 {{ BALLS.IND }}개, 대만은 {{ BALLS.TWN }}개예요.</li>
          <li><b>공 하나 뽑기</b>어떤 나라가 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수. 예를 들어 대만은 {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}, 대략 {{ oneIn(pIso('TWN')) }}번에 한 번이에요.</li>
          <li><b>그 나라의 HDI로 상이 정해져요</b>HDI(인간개발지수)는 0에서 1 사이의 점수로, 평균 수명·교육 기간·소득을 합쳐서 계산해요. 1에 가까울수록 살기 좋은 나라예요. HDI가 높을수록 큰 상이지만, 그런 나라는 인구가 적어서 뽑기 어려워요.</li>
        </ol>
        <ol v-else class="steps">
          <li><b>Turn people into balls</b>We make 1 ball for every {{ fmtBig(POP_UNIT) }} people. Even the smallest country gets 1 ball. That makes {{ BALL_TOTAL }} balls in total. India has the most people, so it gets {{ BALLS.IND }} balls. Taiwan gets {{ BALLS.TWN }}.</li>
          <li><b>Pick one ball</b>Your chance of getting a country is its number of balls divided by all the balls. For Taiwan, that's {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}. That's about 1 in {{ oneIn(pIso('TWN')) }}.</li>
          <li><b>The country's HDI is your prize</b>HDI is a score from 0 to 1. It shows how long people live, how many years they go to school, and how much money they make. A higher score means a better life and a bigger prize. But high-score countries have fewer people, so they are harder to get.</li>
        </ol>
        <h3>{{ L('More details', '更多說明', 'くわしい説明', '자세한 설명') }}</h3>
        <ol v-if="lang === 'en'" class="how">
          <li><b>Idea</b>You can't choose where you're born — it's a lottery. Treat every person on Earth as one ticket: countries with more people hold more tickets, so India and China are the most likely draws. Your "prize" is that country's Human Development Index — life expectancy, education and income combined.</li>
          <li><b>Population</b>English Wikipedia, "<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>", sovereign states only: the 193 UN members, the two observer states (Vatican City and Palestine), plus Taiwan — {{ meta.count }} countries in all.</li>
          <li><b>HDI</b>English Wikipedia, "<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>", using UNDP's {{ meta.hdi.year }} HDI from the 2025 Human Development Report. Taiwan isn't in the UNDP data, so its {{ C.TWN.hdi }} (2023) comes from the <a :href="SOURCES[2].url" target="_blank" rel="noopener">English Wikipedia Taiwan</a> infobox. North Korea uses {{ C.PRK.hdi }} ({{ meta.prk.year }}) from the <a :href="SOURCES[3].url" target="_blank" rel="noopener">Chinese Wikipedia</a> infobox. Monaco and Vatican City have no HDI, so drawing them means a redraw.</li>
          <li><b>Prizes</b>Countries are ranked by HDI and cut into {{ TIERS.length }} tiers. Each tier is more likely than the one above, as close as possible to 1:2:4:8:16:32:64:128. Countries with the same HDI aren't split, so the ratios are close but not exact.</li>
          <li><b>Balls</b>{{ BALL_TOTAL }} balls in all, at least one per country ({{ ONE_BALL }} countries have just one). Otherwise one ball ≈ {{ fmtBig(POP_UNIT) }} people; India has the most ({{ BALLS.IND }}). Tiny countries still get one ball, so their odds are a bit higher than their population share.</li>
          <li><b>Map</b>Countries are colored by prize. Draws follow population share; each drawn country gets a circle whose area is its share of all your draws, which approaches the population share as you draw more. Borders from <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:50m.</li>
          <li><b>Box modes</b>The balls packed into a 3D clear acrylic case with the lid open. World Box groups countries by where they are in the world; Prize Box lines the balls up by prize — Grand Prize first — with dividers and a different pastel for each prize. The drawn ball floats up and grows.</li>
          <li><b>Lottery drum (Game)</b>All {{ BALL_TOTAL }} balls go into a 3D clear drum, and the draw is decided entirely by the physics simulation. The drum spins (each spin's length is multiplied by a random 0.85–1.15), three paddles carry the balls up and tumble them; then the outlet turns to the bottom and the gate opens, and the first ball to fall through is the winner, rolling down the chute into the tray. If it's a redraw ball, the drum spins again.</li>
        </ol>
        <ol v-else-if="lang === 'ja'" class="how">
          <li><b>アイデア</b>どこに生まれるかは自分で選べない——まるで宝くじ。地球上の一人ひとりを 1 枚のくじと考えると、人口の多い国ほどくじが多いので、インドや中国がいちばん当たりやすくなります。当たった「賞品」はその国の人間開発指数（寿命・教育・所得をまとめた暮らしの指標）です。</li>
          <li><b>人口</b>英語版ウィキペディア「<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>」から主権国家のみ：国連加盟 193 か国、オブザーバー国家の 2 か国（バチカン・パレスチナ）、そして台湾、計 {{ meta.count }} か国。</li>
          <li><b>HDI</b>英語版ウィキペディア「<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>」、UNDP『人間開発報告書 2025』の {{ meta.hdi.year }} 年の値。台湾は UNDP のデータにないので、英語版ウィキペディア <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> の情報ボックスの {{ C.TWN.hdi }}（2023 年）。北朝鮮は<a :href="SOURCES[3].url" target="_blank" rel="noopener">中国語版ウィキペディア</a>の {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。モナコとバチカンは HDI がないので、当たったら引き直しです。</li>
          <li><b>賞</b>国を HDI の高い順に並べて {{ TIERS.length }} 段に分け、下の賞ほど当たりやすく、なるべく 1:2:4:8:16:32:64:128 に近づけています。同じ HDI の国は分けないので、ぴったりにはなりません。</li>
          <li><b>ボール</b>全部で {{ BALL_TOTAL }} 個、どの国も最低 1 個（{{ ONE_BALL }} か国は 1 個だけ）。それ以外はボール 1 個 ≈ {{ fmtBig(POP_UNIT) }} 人で、いちばん多いのはインド（{{ BALLS.IND }} 個）。人口がとても少ない国も 1 個あるので、人口の割合より少し当たりやすくなります。</li>
          <li><b>地図</b>国を賞の色で塗り分けています。抽選は人口の割合どおり。「当選済み」をオンにすると当たった国に円を描き、円の面積＝その国の当選回数の割合。たくさん引くほど人口の割合に近づきます。国境は <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> の 1:5,000 万。</li>
          <li><b>ボール箱</b>ボールを 3D の透明アクリルケースに入れ、ふたを開けています。「世界ボール箱」は各国の世界での位置どおりに並べ、「賞別ボール箱」は特賞から残念賞まで賞の順に並べて、賞ごとに仕切りと色を変えています。当たったボールは浮き上がって大きくなります。</li>
          <li><b>抽選機（ゲーム）</b>{{ BALL_TOTAL }} 個のボールを 3D の透明ドラムに入れ、どれが出るかはすべて物理シミュレーションで決まります。ドラムが回り（毎回の回転時間に 0.85〜1.15 の乱数を掛けます）、中の 3 枚の羽根がボールを持ち上げてかき混ぜます。止まると出口が真下に来てゲートが開き、最初に重力で穴を通ったボールが当たり。シュートを転がって前のトレーに入ります。引き直しボールならもう一度回します。</li>
        </ol>
        <ol v-else-if="lang === 'ko'" class="how">
          <li><b>아이디어</b>어디서 태어날지는 스스로 고를 수 없어요 — 마치 복권처럼요. 지구의 모든 사람을 복권 한 장으로 생각하면, 인구가 많은 나라일수록 복권이 많아서 인도와 중국이 가장 잘 뽑혀요. 받는 「상품」은 그 나라의 인간개발지수(수명·교육·소득을 합친 생활 수준)예요.</li>
          <li><b>인구</b>영어 위키백과 「<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>」에서 주권 국가만: 유엔 회원국 193개국, 옵서버 국가 2개국(바티칸·팔레스타인), 그리고 대만, 모두 {{ meta.count }}개국.</li>
          <li><b>HDI</b>영어 위키백과 「<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>」, UNDP 「인간개발보고서 2025」의 {{ meta.hdi.year }}년 수치. 대만은 UNDP 자료에 없어서 영어 위키백과 <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> 정보 상자의 {{ C.TWN.hdi }}(2023년)을 써요. 북한은 <a :href="SOURCES[3].url" target="_blank" rel="noopener">중국어 위키백과</a>의 {{ C.PRK.hdi }}({{ meta.prk.year }}년). 모나코와 바티칸은 HDI가 없어서 뽑히면 다시 뽑아요.</li>
          <li><b>상</b>나라를 HDI 높은 순으로 줄 세워 {{ TIERS.length }}단계로 나눴어요. 아래 상일수록 뽑힐 확률이 커서 1:2:4:8:16:32:64:128에 최대한 가깝게 맞췄어요. 같은 HDI는 나누지 않아서 딱 맞지는 않아요.</li>
          <li><b>공</b>모두 {{ BALL_TOTAL }}개, 모든 나라가 최소 1개({{ ONE_BALL }}개국은 1개뿐). 나머지는 공 1개 ≈ {{ fmtBig(POP_UNIT) }}명이고, 가장 많은 나라는 인도({{ BALLS.IND }}개). 인구가 아주 적은 나라도 1개가 있어서 인구 비율보다 조금 더 잘 뽑혀요.</li>
          <li><b>지도</b>나라를 상 색깔로 칠했어요. 뽑기는 인구 비율대로예요. 「뽑힌 곳」을 켜면 뽑힌 나라에 원을 그리고, 원의 면적 = 그 나라가 뽑힌 횟수의 비율. 많이 뽑을수록 인구 비율에 가까워져요. 국경은 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000만.</li>
          <li><b>공 상자</b>공을 3D 투명 아크릴 상자에 담고 뚜껑을 열어 두었어요. 「세계 공 상자」는 나라들의 세계 속 위치대로, 「상별 공 상자」는 특등부터 꽝까지 상 순서로 늘어놓고 상마다 칸막이와 색을 달리했어요. 뽑힌 공은 떠올라서 커져요.</li>
          <li><b>추첨기 (게임)</b>공 {{ BALL_TOTAL }}개를 3D 투명 드럼에 넣고, 어느 공이 나올지는 전부 물리 시뮬레이션으로 정해져요. 드럼이 돌고(돌리는 시간에 매번 0.85~1.15의 난수를 곱해요), 안의 날개 3개가 공을 들어 올려 섞어요. 멈추면 출구가 바로 아래로 오고 문이 열려, 중력으로 가장 먼저 구멍을 통과한 공이 당첨! 미끄럼틀을 굴러 앞의 쟁반에 들어가요. 다시 뽑기 공이면 한 번 더 돌려요.</li>
        </ol>
        <ol v-else class="how">
          <li><b>想法</b>出生在哪裡自己選不了，就像抽樂透。全世界每個人當成一張彩券，人越多的國家彩券越多，所以抽到印度、中國的機會最大；抽到後拿到的「獎品」是那個國家的人類發展指數——壽命、教育、所得綜合起來的生活條件。</li>
          <li><b>人口</b>英文維基百科〈<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>〉，只看正式國家：聯合國 193 個會員國、梵蒂岡和巴勒斯坦兩個觀察員國，加上臺灣，共 {{ meta.count }} 國。</li>
          <li><b>HDI</b>英文維基百科〈<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>〉，數字是 UNDP《2025 人類發展報告》的 {{ meta.hdi.year }} 年 HDI。臺灣不在 UNDP 資料裡，用英文維基 <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> 條目資訊框的 {{ C.TWN.hdi }}（2023 年）。北韓用<a :href="SOURCES[3].url" target="_blank" rel="noopener">中文維基</a>資訊框的 {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。摩納哥、梵蒂岡沒有 HDI，抽到算「重抽」。</li>
          <li><b>獎項</b>把國家照 HDI 由高到低排，切成 {{ TIERS.length }} 段，每一級的中獎機率都比上一級大，盡量接近 1:2:4:8:16:32:64:128；同一個 HDI 不拆開，所以只能接近，不會剛好。</li>
          <li><b>彩球</b>總共 {{ BALL_TOTAL }} 顆，每國至少 1 顆（{{ ONE_BALL }} 國只有 1 顆）；其他國家 1 顆＝平均 {{ fmtBig(POP_UNIT) }} 人，印度最多（{{ BALLS.IND }} 顆）。人口很少的國家也有 1 顆，抽中的機會比人口比例高。</li>
          <li><b>地圖模式</b>國家照獎項填色；抽籤照人口比例，抽過的國家畫投胎紀錄圓，圓面積＝這一國抽中的次數佔全部的幾成，抽得越多越接近各國人口比例。地圖用 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000 萬國界。</li>
          <li><b>彩球盒</b>把球裝進 3D 的透明壓克力收納盒、蓋子打開；「世界彩球盒」照各國在世界上的相對位置放，同一洲的國家在一起；「獎項彩球盒」照獎項從特獎排到哈哈獎，每一獎用隔板隔開、鋪不同的淡色。抽到的那顆浮起來放大。</li>
          <li><b>搖獎機（遊戲模式）</b>{{ BALL_TOTAL }} 顆球放進 3D 的透明滾筒，抽到哪一顆全部照物理模擬決定。滾筒轉起來（每次轉的時間乘 0.85～1.15 的亂數），筒裡三片擋板把球帶上去再翻下來；停下來後出球口轉到正下方、打開閘門，哪一顆球靠重力先穿過洞口就是抽到的，沿著滑道滾進前面的盤子。掉出來的是重抽球就再搖一次。</li>
        </ol>

        <h3>{{ L('Website', '網址', 'URL', '주소') }}</h3>
        <p class="card"><a class="url" :href="SITE" target="_blank" rel="noopener">{{ SITE }}</a></p>

        <h3>{{ L('Data sources', '資料來源', 'データ出典', '자료 출처') }}</h3>
        <ul class="src">
          <li v-for="s in SOURCES" :key="s.url"><b>{{ L(...s.label) }}</b>{{ L(...s.org) }}<a :href="s.url" target="_blank" rel="noopener">{{ s.url }}</a></li>
        </ul>
      </section>
    </main>
    </aside>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import LotteryDrum from './components/LotteryDrum.vue'
import LotteryBox from './components/LotteryBox.vue'
import MapModes from './components/MapModes.vue'
import WorldLocator from './components/WorldLocator.vue'
import FlagBall from './components/FlagBall.vue'
import { L, lang, LANGS, isCJK } from './i18n.js'
import {
  MODES, mode, drawOne, drawBall, cellMeta, cellsSnap, boxRank,
  meta, C, ISOS, BALLS, BALL_TOTAL, POP_UNIT, ONE_BALL, balls, isoOfBall, colors, flagMeta, flagsUrl, flagStyle, ballTip,
  TIERS, TIER_EN_FULL, tierShort, TIER_R, NODATA, noHdi, noHdiNames, tierIdx, tierOfHdi, nameOf, prizeOf, colorOf,
  HDI_EXPECT, pTier, pIso, fmtP, oneIn, fmtBig,
} from './lottery.js'

const SOURCES = [
  { label: ['Human Development Index (UNDP Human Development Report 2025, 2023 data)', '人類發展指數 HDI（UNDP《2025 人類發展報告》，2023 年）', '人間開発指数 HDI（UNDP『人間開発報告書 2025』、2023 年）', '인간개발지수 HDI (UNDP 「인간개발보고서 2025」, 2023년)'], org: ['English Wikipedia: List of countries by Human Development Index', '英文維基百科 List of countries by Human Development Index', '英語版ウィキペディア List of countries by Human Development Index', '영어 위키백과 List of countries by Human Development Index'], url: 'https://en.wikipedia.org/wiki/List_of_countries_by_Human_Development_Index' },
  { label: ['Population', '各國人口', '各国の人口', '나라별 인구'], org: ['English Wikipedia: List of countries and dependencies by population', '英文維基百科 List of countries and dependencies by population', '英語版ウィキペディア List of countries and dependencies by population', '영어 위키백과 List of countries and dependencies by population'], url: 'https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population' },
  { label: ['Taiwan HDI (not covered by UNDP)', '臺灣 HDI（UNDP 不含臺灣）', '台湾の HDI（UNDP に含まれない）', '대만 HDI (UNDP 미포함)'], org: ['English Wikipedia: Taiwan article infobox', '英文維基百科 Taiwan 條目資訊框', '英語版ウィキペディア Taiwan 記事の情報ボックス', '영어 위키백과 Taiwan 문서 정보 상자'], url: 'https://en.wikipedia.org/wiki/Taiwan' },
  { label: ['North Korea HDI (not covered by UNDP, 2016)', '北韓 HDI（UNDP 沒算，2016 年）', '北朝鮮の HDI（UNDP 対象外、2016 年）', '북한 HDI (UNDP 미산출, 2016년)'], org: ['Chinese Wikipedia: North Korea article infobox', '中文維基百科「朝鲜民主主义人民共和国」條目資訊框', '中国語版ウィキペディア「朝鲜民主主义人民共和国」の情報ボックス', '중국어 위키백과 「朝鲜民主主义人民共和国」 문서 정보 상자'], url: 'https://zh.wikipedia.org/wiki/朝鲜民主主义人民共和国' },
  { label: ['Flags (1:1 square SVG, 7.6.0)', '國旗（1:1 正方形 SVG，7.6.0）', '国旗（1:1 正方形 SVG、7.6.0）', '국기 (1:1 정사각형 SVG, 7.6.0)'], org: ['flag-icons (MIT)', 'flag-icons（MIT）', 'flag-icons（MIT）', 'flag-icons (MIT)'], url: 'https://github.com/lipis/flag-icons' },
  { label: ['Borders (1:50m Admin 0 – Countries)', '國界（1:50m Admin 0 – Countries）', '国境（1:50m Admin 0 – Countries）', '국경 (1:50m Admin 0 – Countries)'], org: ['Natural Earth (public domain)', 'Natural Earth（公有領域）', 'Natural Earth（パブリックドメイン）', 'Natural Earth (퍼블릭 도메인)'], url: 'https://www.naturalearthdata.com/' },
]
// 實際網頁
const SITE = 'https://szfftz.github.io/birth-lottery/'
// 結果分頁底下的操作提示（[英文, 中文, 日文, 韓文]）
const HINTS = {
  game: ['Shake your phone to spin too. Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '搖一搖手機也能開始搖獎。左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', 'スマホを振っても回せます。左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '휴대폰을 흔들어도 돌릴 수 있어요. 좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
  map: ['Drag and pinch to move the map; tap a country to see its odds and HDI.', '拖曳、兩指縮放地圖；點一個國家看機率和 HDI。', 'ドラッグ・2 本指で地図を動かせます。国をタップすると確率と HDI を表示。', '드래그·두 손가락으로 지도를 움직여요. 나라를 탭하면 확률과 HDI가 보여요.'],
  box: ['Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', '左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
  boxp: ['Drag sideways to orbit; pinch to zoom and move; tap a ball to see its country.', '左右拖曳轉一圈；兩指縮放、移動；點一顆球看是哪一國。', '左右にドラッグで回転、2 本指でズーム・移動、ボールをタップで国名を表示。', '좌우로 드래그하면 회전, 두 손가락으로 확대·이동, 공을 탭하면 나라가 보여요.'],
}

const face = 'flag' // 球面一律國旗

// 舞台蓋滿整個畫面：上面狀態列、下面浮動操作列擋住的高度（px），傳給各模式把內容放在看得到的地方
const phoneEl = ref(null), dockEl = ref(null), safeTopEl = ref(null)
const insets = reactive({ top: 0, bottom: 0 })
// 最上面的中／英切換佔的高度：每個模式的內容（招牌、地圖、盒子）都往下讓這麼多
const LANG_H = 44
// 最上面一排：左邊頁面名稱、右邊中／英切換
const topInset = computed(() => insets.top + LANG_H)
// 手機最下面的安全區（Home 條）高度：地圖、彩球盒面板蓋住操作列，只要避開這一塊
const safeBottom = ref(0)
onMounted(() => { const t = document.createElement('i'); t.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);visibility:hidden'; document.body.appendChild(t); safeBottom.value = t.offsetHeight; t.remove() })
const modeLabel = computed(() => MODES.find((m) => m.key === mode.value)?.label ?? '')
const setLang = (v) => (lang.value = v)
function measure() {
  if (!phoneEl.value || !dockEl.value) return
  const ph = phoneEl.value.getBoundingClientRect(), dk = dockEl.value.getBoundingClientRect()
  insets.top = Math.round(safeTopEl.value?.offsetHeight ?? 0)
  insets.bottom = Math.round(ph.bottom - dk.top)
}
let insetRo
onMounted(() => {
  insetRo = new ResizeObserver(measure)
  insetRo.observe(phoneEl.value)
  insetRo.observe(dockEl.value)
  measure()
})
onBeforeUnmount(() => insetRo?.disconnect())
const TABS = [['result', 'Result', '結果', '結果', '결과'], ['history', 'History', '歷史', '履歴', '기록'], ['prize', 'Prizes', '獎項', '賞', '상'], ['about', 'About', '說明', '説明', '설명']].map(([key, ...t]) => ({ key, get label() { return L(...t) } }))
const tab = ref('result')
// 資訊面板：開關、往下拖的距離（拖超過 80px 就收起來）
const sheet = ref(false)
function openSheet(t) {
  if (t) tab.value = t
  sheet.value = true
}
const dragY = ref(0)
let drag0 = null
const dragFor = ref(null) // 正在拉哪一個面板：info＝資訊、view＝地圖／彩球盒
function dragStart(e) {
  if (e.target.closest('button')) return
  drag0 = e.clientY
  dragFor.value = e.currentTarget.dataset.s
  e.currentTarget.setPointerCapture(e.pointerId)
}
function dragMove(e) { if (drag0 != null) dragY.value = Math.max(0, e.clientY - drag0) }
function dragEnd() {
  if (drag0 == null) return
  if (dragY.value > 80) { if (dragFor.value === 'view') setMode('game'); else sheet.value = false }
  drag0 = null
  dragY.value = 0
}
const SORTS = [['pop', 'By odds', '照機率', '確率順', '확률순'], ['hdi', 'By HDI', '照 HDI', 'HDI 順', 'HDI순']].map(([key, ...t]) => ({ key, get label() { return L(...t) } }))
const sort = ref('pop')
const sorted = computed(() => (sort.value === 'pop' ? ISOS : [...ISOS].sort((a, b) => (C[b].hdi ?? -1) - (C[a].hdi ?? -1))))
const maxTierP = Math.max(...TIERS.map((t) => pTier(t)))
const menu = ref(false) // 模式選單開著沒
function setMode(m) {
  if (spinning.value) return
  mode.value = m
  // 抽到的那顆球留著（切模式也一樣），下一次抽才換
}
// 點清單：只把它標成「這次」，不算一次投胎
function pick(iso) {
  lastRerolls.value = 0
  last.value = iso
  lastBall.value = null
}

// 國旗拼圖（three.js 貼圖用）
const atlas = ref(null)
// 國旗拼圖：一律用 <img> 載入。不用 createImageBitmap：有些 iPhone Safari 把 ImageBitmap 傳進 WebGL 會變全黑（球都黑的）
function loadImg() {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = flagsUrl })
}
loadImg().then((a) => (atlas.value = a)).catch(() => setTimeout(() => loadImg().then((a) => (atlas.value = a)), 1500))

const counts = reactive({})
const history = reactive([]) // 每一次抽的結果：{ n, iso, ball, time }
const historyDesc = computed(() => history.slice().reverse())
const total = ref(0)
const last = ref(null)
const lastBall = ref(null)
const rerolls = ref(0) // 抽到沒有 HDI 的國家（摩納哥、梵蒂岡）就自動再搖，不算投胎次數
const lastRerolls = ref(0)
// 歷史存在 localStorage：重新整理還在；載入時用它重建次數、各國中幾次、最後一次
const HISTORY_KEY = 'birth-lottery:history'
try {
  const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  for (const h of Array.isArray(saved) ? saved : []) {
    if (!h || !C[h.iso]) continue
    history.push({ n: history.length + 1, iso: h.iso, ball: Number.isInteger(h.ball) ? h.ball : null, time: String(h.time ?? '') })
    counts[h.iso] = (counts[h.iso] ?? 0) + 1
  }
  total.value = history.length
  last.value = history.at(-1)?.iso ?? null
} catch { /* 讀不到就從空的開始 */ }
watch(history, () => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch { /* 存不了就算了 */ } })
function clearHistory() {
  if (spinning.value || !history.length || !confirm(L('Clear all draw history?', '確定要清空所有抽過的結果？', '抽選の履歴をすべて消しますか？', '뽑기 기록을 모두 지울까요?'))) return
  history.splice(0)
  for (const k of Object.keys(counts)) delete counts[k]
  total.value = 0; rerolls.value = 0; lastRerolls.value = 0
  last.value = null; lastBall.value = null
}
const drum = ref(null)
const boxEl = ref(null), mapEl = ref(null) // 彩球盒、地圖（重設視角用）
const showTally = ref(false) // 地圖：抽過的圓開不開（預設關）
const spinning = ref(false)

// 搖手機也會搖獎：手機的加速度（扣掉重力）超過門檻算「甩一下」；同一下會連續好幾筆超過，所以兩下之間至少隔 150ms，
// 1.2 秒內甩 3 下才開始（放下手機、走路、碰一下都不算）；搖獎中、剛搖完 1.5 秒內都不理
let shakeOn = false, shakeHits = [], shakeCool = 0
function onMotion(e) {
  const now = performance.now()
  if (spinning.value || drawing || now < shakeCool || mode.value !== 'game') { shakeHits = []; return } // 搖手機也只在遊戲頁
  let m
  const a = e.acceleration
  if (a && a.x != null) m = Math.hypot(a.x, a.y, a.z) // 已經扣掉重力
  else {
    const g = e.accelerationIncludingGravity
    if (!g || g.x == null) return
    m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81)
  }
  if (m < 13) return
  shakeHits = shakeHits.filter((t) => now - t < 1200)
  if (shakeHits.length && now - shakeHits[shakeHits.length - 1] < 150) return
  shakeHits.push(now)
  if (shakeHits.length >= 3 && atlas.value && !sheet.value) {
    shakeHits = []
    navigator.vibrate?.(40)
    draw()
  }
}
function enableShake() {
  try { enableShake0() } catch {} // 不管怎樣都不能擋到按鈕
}
function enableShake0() {
  if (shakeOn || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return
  const on = () => { shakeOn = true; window.addEventListener('devicemotion', onMotion) }
  const ask = window.DeviceMotionEvent.requestPermission
  if (typeof ask === 'function') Promise.resolve(ask.call(window.DeviceMotionEvent)).then((r) => r === 'granted' && on()).catch(() => {}) // iPhone：要使用者按過才能問
  else on() // Android：不用問
}
// Android 不用權限，一打開就能搖；iPhone 等第一次按「搖一搖」
if (typeof window !== 'undefined' && typeof window.DeviceMotionEvent?.requestPermission !== 'function') enableShake()
onBeforeUnmount(() => window.removeEventListener('devicemotion', onMotion))

// 遊戲模式：搖獎機轉完、掉出來的那顆就是（抽到誰由物理模擬決定）；地圖模式照人口抽一國；其他模式從全部球裡抽一顆
let drawing = false // 正在抽（包含切回遊戲畫面、等搖獎機的那段）：連按、搖手機都不會同時抽兩次
async function draw() {
  enableShake() // 第一次按：iPhone 要在按鈕裡問「動作與方向」權限
  if (spinning.value || drawing) return
  drawing = true
  try { await draw0() } finally { drawing = false; shakeCool = performance.now() + 1500 }
}
async function draw0() {
  // 按 SPIN 一律回到遊戲（搖獎機）畫面再搖；等搖獎機掛好
  if (mode.value !== 'game') {
    setMode('game')
    await nextTick()
    for (let i = 0; i < 60 && !drum.value; i++) await new Promise((r) => setTimeout(r, 50))
  }
  const game = mode.value === 'game'
  if (game && !drum.value) return
  if (game) spinning.value = true
  tab.value = 'result'
  let iso, b, n = 0
  for (;;) {
    if (game) { b = await drum.value.play(); iso = isoOfBall(b) }
    else [iso, b] = mode.value === 'map' ? [drawOne(), null] : drawBall()
    if (tierIdx(iso) >= 0) break
    n++
  }
  if (game) spinning.value = false
  rerolls.value += n
  lastRerolls.value = n
  counts[iso] = (counts[iso] ?? 0) + 1
  total.value++
  history.push({ n: total.value, iso, ball: b ?? null, time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) })
  last.value = iso
  lastBall.value = b
}

const drawnMean = computed(() => {
  let s = 0, n = 0
  for (const [iso, k] of Object.entries(counts)) if (C[iso].hdi != null) { s += C[iso].hdi * k; n += k }
  return n ? s / n : 0
})
const drawnRanked = computed(() => Object.keys(counts).filter((iso) => C[iso].hdi != null).sort((a, b) => C[b].hdi - C[a].hdi))
const best = computed(() => drawnRanked.value[0])
const worst = computed(() => drawnRanked.value.at(-1))
const drawnByTier = computed(() => {
  const out = {}
  for (const [iso, n] of Object.entries(counts)) out[tierIdx(iso)] = (out[tierIdx(iso)] ?? 0) + n
  return out
})
const topDrawn = computed(() => Object.entries(counts).map(([iso, n]) => ({ iso, n })).sort((a, b) => b.n - a.n).slice(0, 8))
</script>

<style scoped>
/* 整個畫面一支「手機」：舞台蓋滿，操作列浮在下面；不捲動；電腦上置中、固定手機大小 */
/* 主題：午夜靛藍＋金色（跟搖獎機舞台同一套） */
.phone { --gold: #f5c451; --teal: #6fd6e0; --pink: #ff4f8b; --glass: rgba(16, 11, 40, 0.6); --glass-line: rgba(255, 226, 160, 0.16); --panel: #120d2b; --tile: #1e1840;
  --muted: #c9c3e3; --dim: #a59ec8;
  position: relative; width: 100%; height: 100vh; height: 100dvh; margin: 0 auto; overflow: hidden; background: #08061a; }
/* 手機、iPad（觸控）：整個畫面滿版。電腦（滑鼠）：照手機的直式比例（430:932）框成一支手機，跟著視窗高度等比例放大縮小 */
@media (hover: hover) and (pointer: fine) and (min-width: 600px) and (min-height: 500px) {
  .phone { height: calc(100dvh - 48px); width: auto; aspect-ratio: 430 / 932; max-width: calc(100vw - 48px); margin: 24px auto; border-radius: 36px;
    box-shadow: 0 0 0 10px #0b0b0b, 0 0 0 11px #333, 0 30px 80px rgba(0, 0, 0, 0.6); }
}
.safe-top { position: absolute; top: 0; height: env(safe-area-inset-top); width: 0; visibility: hidden; }
.stage-wrap { position: absolute; inset: 0; overflow: hidden; background: #08061a; }
/* 玻璃：操作列、選單、結果卡 */
.glass { background: var(--glass); border: 1px solid var(--glass-line); -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08); }

/* 載入中：紫→粉→黃的舞台色，一顆彈跳的球 */
.loading { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px; text-align: center; color: #fff;
  /* 跟舞台同一面牆：深酒紅＋金色細線菱格 */
  background:
    repeating-linear-gradient(60deg, transparent 0 46px, rgba(255, 200, 100, 0.07) 46px 48px),
    repeating-linear-gradient(-60deg, transparent 0 46px, rgba(255, 200, 100, 0.07) 46px 48px),
    radial-gradient(120% 70% at 50% 45%, #7a1424 0%, #4a0b18 38%, #22060e 70%, #0c0306 100%); }
.ld-ball { width: 60px; height: 60px; margin-bottom: 6px; animation: ld-bounce 0.7s cubic-bezier(0.3, 0, 0.6, 1) infinite alternate; }
.ld-ball i { display: block; width: 100%; height: 100%; border-radius: 50%; animation: ld-spin 1.4s linear infinite;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.9) 0 10%, transparent 34%), conic-gradient(#ff3f74 0 25%, #ffd000 0 50%, #5fae8e 0 75%, #3f93a6 0); box-shadow: 0 0 0 3px #f5c451, 0 8px 20px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 196, 90, 0.5); }
@keyframes ld-bounce { from { transform: translateY(-18px); } to { transform: translateY(6px) scaleY(0.94); } }
@keyframes ld-spin { to { transform: rotate(360deg); } }
/* 霓虹招牌：黑底、粉紅燈管框，四種語言的名字一行一行寫 */
.ld-sign { display: flex; flex-direction: column; gap: 6px; min-width: min(300px, 84%); padding: 18px 26px 20px; border-radius: 24px; border: 3px solid #ffd6ec;
  background: linear-gradient(180deg, #120a24, #07040f);
  box-shadow: 0 0 4px #ff2d95, 0 0 14px #ff2d95, 0 0 36px rgba(255, 45, 149, 0.6), inset 0 0 5px #ff2d95, inset 0 0 18px rgba(255, 45, 149, 0.55); animation: ld-hum 1.6s ease-in-out infinite; }
@keyframes ld-hum { 50% { box-shadow: 0 0 6px #ff2d95, 0 0 22px #ff2d95, 0 0 52px rgba(255, 45, 149, 0.75), inset 0 0 7px #ff2d95, inset 0 0 24px rgba(255, 45, 149, 0.7); } }
.ld-row { font-family: 'Huninn', 'Noto Sans TC', sans-serif; font-size: 34px; font-weight: 500; line-height: 1.2; letter-spacing: 0.08em; white-space: nowrap; }
.ld-row.ja { font-family: 'M PLUS Rounded 1c', 'Huninn', sans-serif; font-weight: 800; font-size: 26px; }
.ld-row.ko { font-family: 'Jua', -apple-system, 'Apple SD Gothic Neo', sans-serif; font-size: 26px; }
.ld-row.en { font-family: 'Tilt Neon', 'Overpass', sans-serif; font-size: 24px; letter-spacing: 0.06em; }
.ld-row .n-pink { color: #ffe3f1; text-shadow: 0 0 2px #fff, 0 0 8px #ff4fae, 0 0 18px #ff2d95, 0 0 36px #ff2d95; }
.ld-row .n-cyan { color: #e2feff; text-shadow: 0 0 2px #fff, 0 0 8px #3defff, 0 0 18px #19e6ff, 0 0 36px #19e6ff; }
.ld-sub { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px 8px; margin-top: 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.06em; color: #fff3b0; text-shadow: 0 0 8px rgba(255, 200, 90, 0.6); }
.ld-sub i { font-style: normal; font-size: 8px; color: #ff6fc1; }
.ld-dots { display: flex; gap: 8px; }
.ld-dots i { width: 8px; height: 8px; border-radius: 50%; background: #ffe08a; box-shadow: 0 0 8px #ffb000; animation: d-dot 0.9s ease-in-out infinite; }
.ld-dots i:nth-child(2) { animation-delay: 0.15s; }
.ld-dots i:nth-child(3) { animation-delay: 0.3s; }
@media (prefers-reduced-motion: reduce) { .ld-ball, .ld-ball i, .ld-sign, .ld-dots i { animation: none; } }

/* 中／英切換 */
.lang-switch { position: absolute; z-index: 14; right: 12px; display: flex; gap: 2px; padding: 3px; border-radius: 999px; }
.lang-switch button { min-width: 34px; height: 28px; padding: 0 8px; border: 0; border-radius: 999px; background: none; color: rgba(255, 255, 255, 0.75); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.lang-switch button.on { background: linear-gradient(180deg, #ffe08a, var(--gold)); color: #2a1a05; }
/* ── 操作列：只有搖一搖按鈕，沒有外框 ── */
.dock { position: absolute; z-index: 12; left: 20px; right: 20px; bottom: max(14px, env(safe-area-inset-bottom)); display: flex; gap: 8px; align-items: center; }
.ibtn { position: relative; flex: none; display: grid; place-items: center; width: 52px; height: 52px; padding: 0; border: 1px solid var(--glass-line); border-radius: 18px;
  background: rgba(255, 255, 255, 0.07); color: #fff; cursor: pointer; transition: background 0.15s, transform 0.1s; }
.ibtn:active:not(:disabled) { transform: scale(0.94); }
.ibtn.on { background: var(--gold); color: #2a1a05; }
.ibtn:disabled { opacity: 0.4; cursor: default; }
.badge { position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--gold); color: #161616;
  font-size: 12px; font-weight: 800; line-height: 20px; text-align: center; box-shadow: 0 0 0 2px rgba(20, 20, 24, 0.9); }
/* 左右兩顆小按鈕：做成賭場籌碼（紅底、白色邊條、金邊） */
.dock .ibtn { border-radius: 50%; border: 2px solid #f5c451;
  background: radial-gradient(circle, #a3121f 0 52%, #f5c451 53% 56%, transparent 57%), repeating-conic-gradient(#ffffff 0 14deg, #b3121f 14deg 45deg);
  box-shadow: 0 3px 0 #5a0a12, 0 6px 12px rgba(0, 0, 0, 0.45); }
.dock .ibtn.on { background: radial-gradient(circle, #f5c451 0 52%, #fff3c4 53% 56%, transparent 57%), repeating-conic-gradient(#ffffff 0 14deg, #b3121f 14deg 45deg); }
/* DRAW：街機按鈕（金框上一圈會跑的燈泡、紅色圓頂、兩邊閃星星，按下去會陷下去） */
.draw { position: relative; flex: 1; height: 56px; padding: 7px; border: 0; border-radius: 18px; cursor: pointer; font: inherit;
  background: linear-gradient(160deg, #fff3c4, #d9a72e 45%, #8a6414); box-shadow: 0 4px 0 #5a420b, 0 8px 18px rgba(0, 0, 0, 0.35); transition: transform 0.08s, box-shadow 0.08s; }
.d-dome { position: relative; display: flex; align-items: center; justify-content: center; gap: 2px; height: 100%; border-radius: 15px; overflow: hidden;
  background: radial-gradient(ellipse 70% 140% at 40% 0%, #ff8a8a 0%, #e0142a 48%, #8a0612 100%); color: #fff;
  box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.45); }
.d-dome::after { content: ''; position: absolute; top: -40%; bottom: -40%; left: -60px; width: 40px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent); animation: d-sweep 3.2s ease-in-out infinite; }
/* 金框上下兩排小燈泡，往前跑 */
.d-bulbs { position: absolute; inset: 1px 6px; pointer-events: none; border-radius: 16px;
  background: radial-gradient(circle, #fffbe0 0 1.6px, #ffcf3a 2.4px, transparent 3.2px) 0 0 / 12px 6px repeat-x,
    radial-gradient(circle, #fffbe0 0 1.6px, #ffcf3a 2.4px, transparent 3.2px) 0 100% / 12px 6px repeat-x;
  filter: drop-shadow(0 0 2px #ffe27a); animation: d-chase 0.6s steps(2) infinite; }
@keyframes d-chase { to { background-position: 12px 0, -12px 100%; } }
.d-dome { z-index: 1; }
.d-star { font-style: normal; font-size: 16px; color: #fff3b0; margin: 0 clamp(4px, 2.5vw, 10px); text-shadow: 0 0 6px #ffd000, 0 0 12px #ffb000; animation: d-twinkle 0.8s steps(1) infinite; }
.d-star.r { animation-delay: 0.4s; }
@keyframes d-twinkle { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .dock, .d-bulbs, .d-star { animation: none; } }
@keyframes d-sweep { 0%, 60% { left: -60px; } 100% { left: 110%; } }
.d-dome b { font-size: clamp(17px, 5.4vw, 22px); font-weight: 900; letter-spacing: 0.12em; white-space: nowrap; text-shadow: 0 2px 0 rgba(90, 0, 10, 0.5); }
.draw:active:not(:disabled), .draw.busy { transform: translateY(3px); box-shadow: 0 1px 0 #5a420b, 0 4px 10px rgba(0, 0, 0, 0.35); }
.draw:disabled { cursor: default; }
.draw:disabled:not(.busy) { filter: grayscale(0.6) brightness(0.8); }
.draw.busy .d-dome { animation: d-glow 0.5s ease-in-out infinite alternate; }
.draw.busy .d-bulbs { animation-duration: 0.2s; }
.draw.busy .d-dome b { font-size: 17px; }
/* 「搖一搖／搖獎中」每個字輪流可愛地搖（平常一下一下跳，搖獎中搖快一點） */
.d-ch { display: inline-block; transform-origin: 50% 80%; animation: d-wobble 1.8s ease-in-out infinite; animation-delay: calc(var(--i) * 0.12s); }
.draw.busy .d-ch { animation: d-shake 0.42s ease-in-out infinite; animation-delay: calc(var(--i) * 0.07s); }
@keyframes d-wobble {
  0%, 55%, 100% { transform: translateY(0) rotate(0) scale(1); }
  62% { transform: translateY(-4px) rotate(-10deg) scale(1.12); }
  70% { transform: translateY(0) rotate(8deg) scale(0.96); }
  78% { transform: translateY(-2px) rotate(-5deg) scale(1.04); }
  86% { transform: translateY(0) rotate(2deg); }
}
@keyframes d-shake {
  0%, 100% { transform: translateY(0) rotate(-9deg); }
  50% { transform: translateY(-3px) rotate(9deg); }
}
@media (prefers-reduced-motion: reduce) { .d-ch, .draw.busy .d-ch { animation: none; } }
@keyframes d-glow { to { filter: brightness(1.3); } }
.d-dots { display: inline-flex; gap: 3px; margin-left: 4px; }
.d-dots i { width: 4px; height: 4px; border-radius: 50%; background: #fff; animation: d-dot 0.9s ease-in-out infinite; }
.d-dots i:nth-child(2) { animation-delay: 0.15s; }
.d-dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes d-dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }

/* 模式選單：從左上的頁面名稱往下展開 */
.modes { position: absolute; z-index: 16; left: 12px; }
.menu { position: absolute; left: 0; top: calc(100% + 10px); z-index: 13; min-width: 190px; margin: 0; padding: 6px; list-style: none; border-radius: 20px;
  background: rgba(18, 13, 43, 0.92); transform-origin: 26px 0; }
.menu button { display: flex; align-items: center; gap: 12px; width: 100%; height: 44px; padding: 0 14px; border: 0; border-radius: 14px; background: none;
  color: rgba(255, 255, 255, 0.72); font: inherit; font-size: 15px; text-align: left; cursor: pointer; white-space: nowrap; }
.menu button:hover { background: rgba(255, 255, 255, 0.06); }
.m-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0.6; }
.menu button.on { background: rgba(245, 196, 81, 0.16); color: #fff; font-weight: 700; }
.menu button.on .m-dot { border: 0; background: var(--gold); opacity: 1; box-shadow: 0 0 8px var(--gold); }
.menu-scrim { position: absolute; inset: 0; z-index: 15; background: rgba(0, 0, 0, 0.25); }
.menu-enter-active, .menu-leave-active { transition: opacity 0.16s, transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: scale(0.85) translateY(-10px); }

.pill { height: 34px; padding: 0 12px; border: 1px solid var(--glass-line); border-radius: 12px; background: rgba(255, 255, 255, 0.08); color: #fff; font: inherit; font-size: 13px; cursor: pointer; }
.pill:disabled { opacity: 0.4; cursor: default; }

/* ── 資訊面板 ── */
.scrim { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 21; display: flex; flex-direction: column; height: 86%; border-radius: 28px 28px 0 0;
  background: var(--panel); box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08); transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
.sheet-head { flex: none; padding: 8px 16px 10px; touch-action: none; cursor: grab; }
.grip { display: block; width: 38px; height: 5px; margin: 0 auto 10px; border-radius: 3px; background: rgba(255, 255, 255, 0.22); }
.sh-row { display: flex; gap: 8px; align-items: center; }
.tabs { flex: 1; display: flex; padding: 3px; border-radius: 14px; background: var(--tile); }
.tabs button { flex: 1; height: 36px; border: 0; border-radius: 11px; background: none; color: rgba(255, 255, 255, 0.68); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s, color 0.15s; }
.tabs button.on { background: linear-gradient(180deg, #ffe08a, var(--gold)); color: #2a1a05; font-weight: 800; box-shadow: 0 2px 8px rgba(245, 196, 81, 0.3); }
.close { flex: none; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; background: var(--tile); color: rgba(255, 255, 255, 0.75); cursor: pointer; }
.sheet .content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.view-scrim { z-index: 13; }
.view-sheet { z-index: 13; overflow: hidden; } /* 蓋住操作列（z 12，搖一搖只在遊戲頁）；左上選單、中英切換還在上面 */
.vs-title { flex: 1; margin: 0; padding-left: 4px; font-size: 18px; font-weight: 800; letter-spacing: 0.1em; color: #fff; text-shadow: 0 0 8px rgba(214, 160, 255, 0.9); }
.vs-reset { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 16px 0 12px; font-size: 14px; letter-spacing: 0.08em; cursor: pointer; }
.vs-tog.off { background: rgba(10, 5, 24, 0.82); border-color: rgba(245, 196, 81, 0.5); color: rgba(255, 255, 255, 0.6); box-shadow: none; text-shadow: none; }
.vs-body { position: relative; flex: 1; min-height: 0; overflow: hidden; }
.sheet-enter-active, .sheet-leave-active { transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.content { padding: 6px 16px calc(28px + env(safe-area-inset-bottom)); font-size: 14px; line-height: 1.6; }
h3 { display: flex; align-items: baseline; gap: 8px; margin: 22px 2px 10px; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.9); }
h3 small { font-size: 13px; font-weight: 500; color: var(--dim); letter-spacing: 0; }
section > h3:first-child { margin-top: 8px; }
.h-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 22px 2px 10px; }
.h-row h3 { margin: 0; }
.pill.clear { flex: none; }
.h-row h3 { margin: 0; }
.hint { display: flex; gap: 6px; align-items: center; margin: 14px 2px 0; font-size: 13px; color: var(--dim); }
.hint svg { flex: none; }
.note { margin: 10px 2px 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
.card { margin: 0; padding: 12px 14px; border-radius: 16px; background: var(--tile); }
.card.flush { padding: 4px 10px; }
.url { color: var(--teal); word-break: break-all; text-decoration: none; }

/* 結果：票卡（上面獎項色光暈） */
.t-title { font-size: 13px; color: rgba(255, 255, 255, 0.65); }
.t-prize { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 12px 0 14px; }
.t-range { width: 100%; font-size: 13px; color: rgba(255, 255, 255, 0.68); }
/* 數字小卡：兩欄 */
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tile { display: flex; flex-direction: column; min-width: 0; padding: 10px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); }
section > .tiles .tile { background: var(--tile); }
.tile.wide { grid-column: 1 / -1; }
.tile.pick { cursor: pointer; }
.tile > span { font-size: 12px; color: rgba(255, 255, 255, 0.68); }
.tile > b { display: flex; align-items: center; gap: 6px; font-size: 22px; font-weight: 800; line-height: 1.3; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile > b.sm { font-size: 16px; }
.tile > b em { font-style: normal; font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.68); }
.tile > small { font-size: 12px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 還沒抽 */
.empty { display: flex; flex-direction: column; align-items: center; padding: 26px 16px 22px; border-radius: 22px; background: var(--tile); text-align: center; }
.e-ball { width: 52px; height: 52px; margin-bottom: 14px; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.9) 0 10%, transparent 34%), conic-gradient(#ff2e88 0 25%, #ffd23f 0 50%, #19d3c5 0 75%, #ff8a00 0); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4); }
.e-ball.spin { animation: ld-spin 0.8s linear infinite; }
.e-main { margin: 0; font-size: 16px; font-weight: 700; }
.e-sub { margin: 8px 0 0; font-size: 13px; color: var(--muted); }
.kbd { display: inline-block; padding: 0 8px; border-radius: 8px; background: linear-gradient(180deg, #ff4d5e, #c4102a); color: #fff; font-weight: 900; letter-spacing: 0.08em; box-shadow: 0 2px 0 #6a0613; }

/* 國家清單：名次、國旗、名字＋獎項、數字（機率最高 10 國多一條比例條） */
.rows { margin: 0; padding: 4px; list-style: none; border-radius: 18px; background: var(--tile); }
.rows li { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px; cursor: pointer; overflow: hidden; }
.rows li + li { box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.05); }
.rows li.on { background: rgba(245, 196, 81, 0.14); box-shadow: inset 0 0 0 1px rgba(245, 196, 81, 0.35); }
.r-n { flex: none; width: 22px; font-size: 13px; font-weight: 700; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }
.fl { flex: none; display: inline-block; width: 26px; height: 26px; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.25); }
.tile .fl { width: 20px; height: 20px; }
.r-name { flex: 1; min-width: 0; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.r-name small { display: flex; align-items: center; font-size: 12px; font-weight: 500; color: var(--dim); }
.r-v { flex: none; font-weight: 700; color: rgba(255, 255, 255, 0.85); font-variant-numeric: tabular-nums; text-align: right; line-height: 1.3; }
.r-v small { display: block; font-size: 12px; font-weight: 600; color: var(--gold); }
.r-bar { position: absolute; left: 0; bottom: 0; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--gold), transparent); opacity: 0.8; }
.sw { display: inline-block; flex: none; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; }
/* 排序切換 */
.seg { display: inline-flex; padding: 3px; border-radius: 12px; background: var(--tile); }
.seg button { height: 28px; padding: 0 10px; border: 0; border-radius: 9px; background: none; color: rgba(255, 255, 255, 0.68); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.seg button.on { background: var(--gold); color: #2a1a05; font-weight: 700; }

/* 獎項表 */

/* 說明 */
.steps { margin: 0 0 8px; padding: 0; list-style: none; counter-reset: st; display: flex; flex-direction: column; gap: 8px; }
.steps li { position: relative; padding: 12px 14px 12px 48px; border-radius: 16px; background: var(--tile); font-size: 14px; line-height: 1.7; color: rgba(255, 255, 255, 0.85); counter-increment: st; }
.steps li::before { content: counter(st); position: absolute; left: 12px; top: 12px; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
  background: radial-gradient(ellipse 70% 140% at 40% 0%, #ff8a8a 0%, #e0142a 48%, #8a0612 100%); box-shadow: inset 0 0 0 2px #f5c451; color: #fff; font-weight: 800; font-size: 14px; }
.steps li b { display: block; margin-bottom: 2px; font-size: 15px; color: #fff; }
.how a, .steps a { color: #ffe08a; text-decoration: underline; text-underline-offset: 2px; }
.formula { margin: 0; padding: 14px 16px; border-radius: 16px; background: var(--tile); font-size: 13px; line-height: 1.9; font-variant-numeric: tabular-nums; }
.how { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.how li { padding: 12px 14px; border-radius: 16px; background: var(--tile); font-size: 13px; line-height: 1.7; color: rgba(255, 255, 255, 0.8); }
.how li b { display: block; margin-bottom: 2px; font-size: 14px; color: #fff; }
.src { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.src li { display: flex; flex-direction: column; padding: 12px 14px; border-radius: 16px; background: var(--tile); font-size: 13px; color: var(--muted); }
.src b { font-size: 13px; color: #fff; font-weight: 700; }
.src a { margin-top: 2px; color: var(--teal); word-break: break-all; text-decoration: none; }

/* 獎項卡：每一獎兩條長條——機率（獎項色）和你抽到的比例（金色） */
.prizes { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
.prizes li { padding: 12px 14px; border-radius: 16px; background: var(--tile); border: 1px solid transparent; }
.prizes li.on { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 0 18px rgba(245, 196, 81, 0.25); }
.p-top { display: grid; grid-template-columns: 1fr auto; align-items: baseline; column-gap: 8px; row-gap: 2px; } /* 獎名＋國數球數一行，HDI 範圍寫在獎名下面 */
.p-name { display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 800; }
.p-name .sw { background: var(--tier); }
.p-hdi { grid-column: 1; grid-row: 2; padding-left: 19px; font-size: 13px; color: var(--muted); }
.p-meta { grid-column: 2; grid-row: 1; font-size: 13px; color: var(--dim); }
.p-bars { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.p-bar { position: relative; display: flex; align-items: center; gap: 8px; height: 22px; padding: 0 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
.p-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; background: color-mix(in srgb, var(--tier) 70%, transparent); transition: width 0.4s; }
.p-bar.mine i { background: linear-gradient(90deg, #b8871f, var(--gold)); }
.p-bar b { position: relative; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.p-bar small { position: relative; margin-left: auto; font-size: 12px; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.t-map { margin: 14px 0 4px; }
/* 結果分頁的票卡：沿用 .result-board，縮到面板寬 */
.result-board.t-board { min-width: 0; padding: 18px 16px 16px; }
.t-board .t-title { position: relative; margin-bottom: 2px; /* 在國名上面，一行寫完 */ font-family: 'Overpass', 'Huninn', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; color: #fff3b0; }
.t-board .t-body { justify-content: flex-start; gap: 12px; margin: 4px 0 0; padding: 0 96px 0 0; } /* 國旗、國名靠左（右上角留給獎牌，國名不要被蓋到） */
.t-board .rb-flag { width: 64px; height: 64px; }
.t-board .rb-name { font-size: 34px; -webkit-text-stroke-width: 5px; text-shadow: 3px 3px 0 #2b0a5e; overflow-wrap: anywhere; }
.t-board .t-medal { top: 6px; right: 6px; scale: 0.7; transform-origin: 100% 0; }
.t-board .t-prize, .t-board .t-map, .t-board .tiles, .t-board .note { position: relative; }
.t-board .t-range { color: rgba(255, 255, 255, 0.8); }
.t-board .tile { background: rgba(43, 10, 94, 0.45); }
.t-board .tile > span, .t-board .tile > small { color: rgba(255, 255, 255, 0.78); }
.t-board .note { color: rgba(255, 255, 255, 0.78); }
.rb-map { position: relative; margin-top: 12px; }
/* ── 舞台上的結果看板（Day 25 原樣，1080×1350 的單位） ── */
.rb-wrap { position: relative; cursor: pointer; animation: rb-pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1); }
@keyframes rb-pop { 0% { transform: scale(0.2) rotate(-6deg); } 60% { transform: scale(1.08) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
.rb-star { position: absolute; font-style: normal; color: #fff6cf; text-shadow: 0 0 10px #ffd23f, 0 0 20px var(--tier); pointer-events: none; animation: rb-twinkle 1.2s ease-in-out infinite; }
.rb-star.s1 { left: -40px; top: -30px; font-size: 40px; }
.rb-star.s2 { right: -30px; top: -46px; font-size: 52px; animation-delay: 0.3s; }
.rb-star.s3 { left: 20%; top: -64px; font-size: 44px; animation-delay: 0.6s; }
.rb-star.s4 { right: 24%; top: -58px; font-size: 44px; animation-delay: 0.9s; }
.rb-star.s5 { left: -56px; bottom: 6px; font-size: 44px; animation-delay: 0.45s; }
.rb-star.s6 { right: -54px; bottom: 16px; font-size: 36px; animation-delay: 0.15s; }
.rb-star.s7 { left: 36%; bottom: -54px; font-size: 44px; animation-delay: 0.75s; }
.rb-star.s8 { right: 8%; bottom: -46px; font-size: 44px; animation-delay: 1.05s; }
@keyframes rb-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0); } 50% { opacity: 1; transform: scale(1.15) rotate(20deg); } }
.rb-shine { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; pointer-events: none; }
.rb-shine::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 70px; left: -120px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent); animation: rb-sweep 2.4s ease-in-out infinite; }
@keyframes rb-sweep { 0% { left: -120px; } 60%, 100% { left: 110%; } }
.result-board { position: relative; min-width: 520px; padding: 14px 22px 16px;
  border-radius: 18px; background: linear-gradient(160deg, #ff4f8b 0%, #7a1fa2 55%, #2f1d74 100%); color: #ffffff;
  border: 4px solid #f5c451; box-shadow: 6px 6px 0 #2b0a5e, 0 0 0 3px #ff8a00, 0 14px 40px rgba(122, 11, 20, 0.45), inset 0 0 30px rgba(0, 0, 0, 0.35); }
.rb-bulbs, .rb-bulbs::after { position: absolute; inset: 5px; border-radius: 13px; pointer-events: none;
  background:
    radial-gradient(circle, #fff6cf 0 2.5px, transparent 3.5px) 0 0 / 18px 100% repeat-x,
    radial-gradient(circle, #fff6cf 0 2.5px, transparent 3.5px) 0 100% / 18px 7px repeat-x,
    radial-gradient(circle, #fff6cf 0 2.5px, transparent 3.5px) 0 0 / 7px 18px repeat-y,
    radial-gradient(circle, #fff6cf 0 2.5px, transparent 3.5px) 100% 0 / 7px 18px repeat-y;
  background-size: 18px 7px, 18px 7px, 7px 18px, 7px 18px; filter: drop-shadow(0 0 3px #ffd75e); }
.rb-bulbs { animation: rb-blink 0.8s steps(1) infinite; }
.rb-bulbs::after { content: ''; inset: 0; background-position: 9px 0, 9px 100%, 0 9px, 100% 9px; animation: rb-blink 0.8s steps(1) infinite reverse; }
@keyframes rb-blink { 50% { opacity: 0.25; } }
/* 國旗＋國名在看板裡水平置中；獎牌另外掛在右上角、壓在所有東西上面 */
.rb-body { position: relative; display: flex; align-items: center; justify-content: flex-start; gap: 18px; padding-right: 80px; } /* 國旗、國名靠左；右邊留給獎牌，國名不要被蓋到 */
.rb-ball { flex: none; padding: 4px; border-radius: 50%; background: linear-gradient(145deg, #fff3c4, #c99a2e); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4); }
.rb-flag { position: relative; width: 110px; height: 110px; border-radius: 50%; overflow: hidden; }
.rb-roll { position: absolute; top: 0; left: 0; display: flex; width: 200%; height: 100%; animation: rb-roll 4s linear infinite; }
.rb-roll i { flex: none; width: 50%; height: 100%; }
@keyframes rb-roll { to { transform: translateX(-50%); } }
.rb-flag::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 32%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.35) 100%); }
.rb-main { flex: 0 1 auto; min-width: 0; }
.rb-name { position: relative; top: 0.12em; /* 字形比行框中心高約 0.12em，往下推一點跟國旗球中心對齊 */ font-family: 'Overpass', 'Huninn', sans-serif; font-size: 54px; font-weight: 900; line-height: 1.05; transform: skewX(-10deg); color: #ffffff;
  -webkit-text-stroke: 6px #2b0a5e; paint-order: stroke fill; text-shadow: 4px 4px 0 #2b0a5e; }
.rb-medal { position: absolute; z-index: 10; top: -86px; right: -70px; width: 128px; height: 128px; scale: 1.45; transform: rotate(14deg); }
/* 獎牌輕輕地左右晃（用 rotate 屬性，跟原本的 transform 斜角疊在一起） */
.rb-medal { animation: md-sway 2.6s ease-in-out infinite; }
@keyframes md-sway {
  0%, 100% { rotate: -5deg; translate: 0 0; }
  25% { translate: 0 -3px; }
  50% { rotate: 5deg; translate: 0 0; }
  75% { translate: 0 -3px; }
}
@media (prefers-reduced-motion: reduce) { .rb-medal { animation: none; } }
.md-tail { position: absolute; top: 84px; width: 32px; height: 76px;
  background: linear-gradient(90deg, var(--tier) 0 38%, #ffd23f 38% 62%, var(--tier) 62%); box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
.md-tail.l { left: 22px; transform: rotate(16deg); }
.md-tail.r { right: 22px; transform: rotate(-16deg); }
.md-coin { position: absolute; inset: 0; padding: 7px; border-radius: 50%;
  background: conic-gradient(from 210deg, #fff6cf, #d9a72e, #fff3b0, #a87818, #ffe68a, #c99a2e, #fff6cf);
  box-shadow: 0 6px 0 #6b4a0c, 0 10px 18px rgba(0, 0, 0, 0.45); }
.md-coin::before { content: ''; position: absolute; inset: 4px; border-radius: 50%; border: 2px dotted rgba(107, 74, 12, 0.55); }
.md-face { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--tier) 55%, #ffffff), var(--tier) 55%, color-mix(in srgb, var(--tier) 70%, #000000));
  box-shadow: inset 0 0 0 2px #fff3b0, inset 0 -6px 10px rgba(0, 0, 0, 0.3);
  color: #ffffff; text-shadow: 0 0 2px #2b0a5e, 0 2px 0 #2b0a5e; font-family: 'Overpass', 'Huninn', sans-serif; line-height: 1; }
.md-face::after { content: ''; position: absolute; top: -30%; bottom: -30%; width: 26px; left: -40px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent); animation: md-glint 3s ease-in-out infinite; }
@keyframes md-glint { 0%, 55% { left: -40px; } 85%, 100% { left: 120%; } }
.md-face em { font-style: normal; font-size: 20px; letter-spacing: 0.05em; color: #fff3b0; }
.md-face b { margin: 0 0 2px; font-size: 34px; font-weight: 900; letter-spacing: 0.02em; }
.md-face.long b { font-size: 26px; }
.md-face small { font-size: 20px; font-weight: 800; letter-spacing: 0.2em; }
.board-enter-active { transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
.board-leave-active { transition: opacity 0.15s ease; }
.board-enter-from { opacity: 0; transform: translateY(30px) scale(0.8); }
.board-leave-to { opacity: 0; }

/* ── 按鈕統一跟主畫面同一套賭場風 ──
   外框（中／英切換、分頁、排序）：深底＋粉紅霓虹燈管邊；選中的：DRAW 那種紅色圓頂＋金邊；
   關閉鈕：跟操作列一樣的籌碼；其他小按鈕（清空…）：金邊紅色小按鈕 */
.lang-switch, .tabs, .seg { background: rgba(10, 5, 24, 0.82); border: 2px solid #ffd6ec; border-radius: 999px;
  box-shadow: 0 0 4px #ff2d95, 0 0 12px rgba(255, 45, 149, 0.7), inset 0 0 6px rgba(255, 45, 149, 0.4); }
.lang-switch { -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.tabs button, .seg button { border-radius: 999px; }
.lang-switch button.on, .tabs button.on, .seg button.on {
  background: radial-gradient(ellipse 70% 140% at 40% 0%, #ff8a8a 0%, #e0142a 48%, #8a0612 100%); color: #ffffff; font-weight: 800;
  box-shadow: inset 0 0 0 2px #f5c451, inset 0 -4px 6px rgba(0, 0, 0, 0.3), 0 0 10px rgba(255, 196, 90, 0.45); text-shadow: 0 1px 0 rgba(90, 0, 10, 0.6); }
.close { border: 2px solid #f5c451; color: #ffffff;
  background: radial-gradient(circle, #a3121f 0 52%, #f5c451 53% 56%, transparent 57%), repeating-conic-gradient(#ffffff 0 14deg, #b3121f 14deg 45deg);
  box-shadow: 0 3px 0 #5a0a12, 0 6px 12px rgba(0, 0, 0, 0.45); }
.pill { border: 2px solid #f5c451; border-radius: 999px; color: #ffffff; font-weight: 800;
  background: radial-gradient(ellipse 70% 140% at 40% 0%, #ff8a8a 0%, #e0142a 48%, #8a0612 100%);
  box-shadow: 0 3px 0 #5a420b, 0 0 10px rgba(255, 196, 90, 0.35); text-shadow: 0 1px 0 rgba(90, 0, 10, 0.6); }
.pill:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 1px 0 #5a420b; }
.r-lbl { margin-right: 4px; font-style: normal; font-size: 12px; font-weight: 600; color: var(--dim); }
/* 模式名稱：跟招牌子標同一套紫色霓虹燈管框 */
.mode-title { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 18px 0 12px; border-radius: 999px; white-space: nowrap; cursor: pointer;
  font: inherit; background: rgba(8, 4, 18, 0.78); border: 2px solid #f1dcff; color: #ffffff; font-size: 17px; font-weight: 800; letter-spacing: 0.12em;
  box-shadow: 0 0 6px #b14dff, 0 0 18px #9b30ff, inset 0 0 8px rgba(177, 77, 255, 0.7); text-shadow: 0 0 8px rgba(214, 160, 255, 0.9);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); transition: transform 0.1s; }
.mode-title svg { flex: none; filter: drop-shadow(0 0 4px #b14dff); }
.mode-title:active:not(:disabled) { transform: scale(0.96); }
.mode-title.on { background: rgba(60, 20, 100, 0.9); }
.m-sep { height: 1px; margin: 6px 8px; background: rgba(241, 220, 255, 0.18); }
.m-ico { flex: none; margin-left: -3px; opacity: 0.85; }
.m-badge { margin-left: auto; min-width: 22px; height: 20px; padding: 0 6px; border-radius: 999px; background: #e0142a; border: 1.5px solid #f5c451; color: #fff; font-size: 12px; font-weight: 800; line-height: 17px; text-align: center; }
.mode-title:disabled { cursor: default; opacity: 0.7; }
/* 滑過（hover）：跟主畫面同一套——沒選中的按鈕亮起粉紅霓虹、選中的紅色圓頂更亮 */
@media (hover: hover) {
  .lang-switch button:not(.on):hover, .tabs button:not(.on):hover, .seg button:not(.on):hover, .menu button:not(.on):hover {
    background: rgba(255, 45, 149, 0.16); color: #ffffff; text-shadow: 0 0 8px #ff4fae; }
  .lang-switch button.on:hover, .tabs button.on:hover, .seg button.on:hover, .pill:hover:not(:disabled), .draw:hover:not(:disabled) { filter: brightness(1.12); }
  .ibtn:hover:not(:disabled), .close:hover { filter: brightness(1.15); box-shadow: 0 3px 0 #5a0a12, 0 0 14px rgba(255, 196, 90, 0.6); }
  .rows li:hover, .tile.pick:hover { background: rgba(255, 45, 149, 0.1); box-shadow: inset 0 0 0 1.5px rgba(255, 214, 236, 0.6); }
}
</style>
