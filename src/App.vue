<template>
  <!-- 投胎樂透（手機版）：整個畫面就是舞台（預設 3D 樂透搖獎機），下面浮著一條玻璃操作列：模式選單（漢堡）、DRAW、資訊；
       結果、歷史、獎項（含統計）、說明收在從下面拉上來的面板（按資訊或點結果卡打開）
       舞台蓋滿整個畫面（含狀態列、操作列後面）；insets＝上面狀態列、下面操作列擋住的高度，傳給各模式把內容放在看得到的地方
       電腦上也是手機寬度（.phone 最寬 430px，置中） -->
  <div ref="phoneEl" class="phone">
    <i ref="safeTopEl" class="safe-top" aria-hidden="true"></i>
    <div class="stage-wrap">
    <Transition name="fade">
      <div v-if="!atlas" class="loading">
        <div class="ld-ball"><i></i></div>
        <div class="ld-title">BIRTH LOTTERY</div>
        <div class="ld-sub">載入中…</div>
      </div>
    </Transition>
    <MapModes v-if="atlas && mapUsed" :face="face" :last="last" :last-ball="lastBall" :counts="counts" :total="total" :atlas="atlas" :inset-top="insets.top" :inset-bottom="insets.bottom" />
    <LotteryBox v-if="atlas && (mode === 'box' || mode === 'boxp')" :key="mode" :balls="balls" :cells="mode === 'boxp' ? boxRank.cells : cellsSnap" :cols="cellMeta.cols" :rows="cellMeta.rows"
      :walls="mode === 'boxp' ? boxRank.walls : []" :frames="mode === 'boxp' ? boxRank.frames : []" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]"
      :face="face" :sel="lastBall" :tip-of="ballTip" bg="#0d0926" :inset-top="insets.top" :inset-bottom="insets.bottom" />
    <LotteryDrum ref="drum" :balls="balls" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]" v-if="atlas && mode === 'game'"
      :face="face" :sel="lastBall" :tip-of="ballTip" :party="spinning ? 0 : total" :spinning="spinning" :inset-top="insets.top" :inset-bottom="insets.bottom">
      <!-- 抽完在搖獎機下面顯示結果看板（國旗、英文國名、獎牌）；點了打開結果面板 -->
      <Transition name="board">
        <div v-if="last && !spinning && lastBall != null" :key="total" class="rb-wrap" :style="{ '--tier': colorOf(last) }" @click="openSheet('result')">
          <div class="rb-burst"></div>
          <i v-for="k in 8" :key="k" class="rb-star" :class="`s${k}`">✦</i>
          <div class="result-board">
            <div class="rb-bulbs"></div>
            <div class="rb-shine"></div>
            <div class="rb-body">
              <div class="rb-ball"><div class="rb-flag" :style="flagStyle(last)"></div></div>
              <div class="rb-main"><div class="rb-name">{{ C[last].name_en }}</div></div>
              <div class="rb-medal">
                <i class="md-tail l"></i><i class="md-tail r"></i>
                <div class="md-coin">
                  <div class="md-face" :class="{ long: TIER_EN[tierIdx(last)].length > 3 }">
                    <b>{{ TIER_EN[tierIdx(last)] }}</b><small>PRIZE</small>
                  </div>
                </div>
              </div>
            </div>
            <WorldLocator compact class="rb-map" :iso="last" :color="colorOf(last)" />
          </div>
        </div>
      </Transition>
    </LotteryDrum>

    <!-- 舞台下緣（操作列上面）浮著的東西：格子模式的換位置工具、遊戲以外的模式抽完的結果卡（點了打開面板） -->
    <div class="stage-foot" :style="{ bottom: `${insets.bottom + 10}px` }">
      <!-- 格子模式：點一顆球、再點另一顆，兩顆交換格子（換過的記在這台裝置） -->
      <div v-if="mode === 'cells'" class="swap glass">
        <span class="swap-hint">換位置：{{ swapPick == null ? '點兩顆球' : '再點一顆' }}</span>
        <button type="button" class="pill" :disabled="!swaps.length" @click="undoSwap">復原</button>
        <button type="button" class="pill" :disabled="!swaps.length" @click="resetSwaps">重設</button>
        <button type="button" class="pill" :disabled="!swaps.length" title="換過的格子寫成 build_cells.py 的 SWAPS 格式，複製到剪貼簿" @click="copySwaps">{{ copiedSwaps ? '已複製' : `複製 ${swaps.length}` }}</button>
      </div>
      <Transition name="chip">
        <button v-if="mode !== 'game' && last && tierIdx(last) >= 0" :key="`${total}-${last}`" type="button" class="chip glass" :style="{ '--tier': colorOf(last) }" @click="openSheet('result')">
          <span class="c-flag" :style="flagStyle(last)"></span>
          <span class="c-main"><b>{{ nameOf(last) }}</b><small>{{ C[last].name_en }}</small></span>
          <span class="c-prize"><b>{{ prizeOf(last) }}</b><small>HDI {{ C[last].hdi.toFixed(3) }}</small></span>
          <svg class="c-go" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
        </button>
      </Transition>
    </div>
    </div>

    <!-- 操作列：浮在舞台上的玻璃條；模式選單（漢堡，往上展開）、DRAW（所有模式共用，唯一的抽獎按鈕）、資訊 -->
    <div v-if="menu" class="menu-scrim" @click="menu = false"></div>
    <div ref="dockEl" class="dock glass">
      <nav class="modes" aria-label="模式">
        <button type="button" class="ibtn" :class="{ on: menu }" :aria-expanded="menu" aria-label="切換模式" :disabled="spinning" @click="menu = !menu">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path :d="menu ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none" /></svg>
        </button>
        <Transition name="menu">
          <ul v-if="menu" class="menu glass" role="menu">
            <li v-for="m in MODES" :key="m.key">
              <button type="button" role="menuitemradio" :aria-checked="mode === m.key" :class="{ on: mode === m.key }" @click="setMode(m.key); menu = false">
                <i class="m-dot"></i>{{ m.label }}
              </button>
            </li>
          </ul>
        </Transition>
      </nav>
      <button type="button" class="draw" :class="{ busy: spinning }" :disabled="spinning || !atlas" @click="draw">
        <span class="d-dome"><b>{{ spinning ? 'ROLLING' : 'DRAW' }}</b><i v-if="spinning" class="d-dots"><i></i><i></i><i></i></i></span>
      </button>
      <button type="button" class="ibtn" aria-label="資訊" @click="openSheet()">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>
        <span v-if="total" class="badge">{{ total > 99 ? '99+' : total }}</span>
      </button>
    </div>

    <!-- 資訊面板：從下面拉上來，蓋在舞台上；點外面、按 ✕、往下滑都會收起來 -->
    <Transition name="fade"><div v-if="sheet" class="scrim" @click="sheet = false"></div></Transition>
    <Transition name="sheet">
    <aside v-if="sheet" class="sheet" role="dialog" aria-label="資訊" :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : null">
    <div class="sheet-head" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
      <i class="grip"></i>
      <div class="sh-row">
        <nav class="tabs" role="tablist">
          <button v-for="t in TABS" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
        </nav>
        <button type="button" class="close" aria-label="關閉" @click="sheet = false">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg>
        </button>
      </div>
    </div>

    <main class="content">
      <!-- 結果 -->
      <section v-if="tab === 'result'">
        <template v-if="last && !spinning && tierIdx(last) >= 0">
          <article class="ticket" :style="{ '--tier': colorOf(last) }">
            <header class="t-head">
              <div class="t-flag" :style="flagStyle(last)"></div>
              <div class="t-who">
                <div class="t-title">第 {{ total.toLocaleString() }} 次投胎・你出生在</div>
                <div class="t-name">{{ nameOf(last) }}</div>
                <div class="t-en">{{ C[last].name_en }}</div>
              </div>
            </header>
            <div class="t-prize">
              <span class="t-badge">{{ prizeOf(last) }}</span>
              <span class="t-pen">{{ TIER_EN_FULL[tierIdx(last)] }}</span>
              <span class="t-range">HDI {{ TIERS[tierIdx(last)].range }}</span>
            </div>
            <WorldLocator class="t-map" :iso="last" :color="colorOf(last)" />
            <div class="tiles">
              <div class="tile"><span>HDI</span><b>{{ C[last].hdi.toFixed(3) }}</b><small>{{ C[last].hdi_rank ? `UNDP 第 ${C[last].hdi_rank} 名` : '不在 UNDP 排名' }}</small></div>
              <div class="tile"><span>抽到這一獎</span><b>{{ fmtP(pTier(TIERS[tierIdx(last)])) }}</b><small>約 1/{{ oneIn(pTier(TIERS[tierIdx(last)])) }}</small></div>
              <div class="tile"><span>抽到這一國</span><b>{{ fmtP(pIso(last)) }}</b><small>約 1/{{ oneIn(pIso(last)) }}</small></div>
              <div v-if="lastBall != null" class="tile"><span>球號</span><b>#{{ (lastBall + 1).toLocaleString() }}</b><small>這國 {{ BALLS[last] }} 顆／共 {{ BALL_TOTAL }} 顆</small></div>
              <div class="tile wide"><span>人口</span><b>{{ C[last].pop.toLocaleString() }}</b><small>{{ C[last].pop_date }}</small></div>
            </div>
            <p v-if="lastRerolls" class="note">先掉出 {{ lastRerolls }} 次重抽球（{{ noHdiNames }}），自動再搖</p>
          </article>
        </template>
        <div v-else class="empty">
          <div class="e-ball" :class="{ spin: spinning }"></div>
          <p v-if="spinning" class="e-main">搖獎中…等球掉進盤子</p>
          <template v-else>
            <p class="e-main">按 <b class="kbd">DRAW</b> 開始投胎</p>
            <p v-if="mode === 'game'" class="e-sub">{{ BALL_TOTAL }} 顆球裡掉出哪一顆，全部照物理模擬決定；抽中的機率＝那一國的球數 ÷ 全部球數。</p>
            <p v-else-if="mode === 'map'" class="e-sub">抽中的機率＝那一國的人口 ÷ 全世界人口。抽過的國家畫白色圓，面積＝抽中次數佔幾成。</p>
            <p v-else class="e-sub">從 {{ BALL_TOTAL }} 顆球裡抽一顆：抽中的機率＝那一國的球數 ÷ 全部球數。</p>
          </template>
        </div>
        <p class="hint"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none" /><path d="M12 11v6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /><circle cx="12" cy="7.5" r="1.3" fill="currentColor" /></svg>{{ HINTS[mode] }}</p>
      </section>

      <!-- 歷史：抽過的結果，新的在上面 -->
      <section v-else-if="tab === 'history'">
        <h3>抽過的結果<small>共 {{ total.toLocaleString() }} 次・新的在上面</small></h3>
        <ol v-if="history.length" class="rows">
          <li v-for="h in historyDesc" :key="h.n" :class="{ on: h.n === total }" @click="pick(h.iso)">
            <span class="r-n">{{ h.n }}</span><i class="fl" :style="flagStyle(h.iso)"></i>
            <span class="r-name">{{ nameOf(h.iso) }}<small><i class="sw" :style="{ background: colorOf(h.iso) }"></i>{{ prizeOf(h.iso) }}・HDI {{ C[h.iso].hdi?.toFixed(3) ?? '—' }}</small></span>
            <b class="r-v">{{ h.time }}<small v-if="h.ball != null">#{{ h.ball + 1 }}</small></b>
          </li>
        </ol>
        <div v-else class="card empty"><p class="e-main">還沒抽過</p><p class="e-sub">按 DRAW 抽一次，結果會一筆一筆記在這裡。</p></div>
      </section>

      <!-- 獎項＋統計：上面是你抽的成績，中間每一獎的「應該中幾成 vs 你中幾成」，下面全部國家 -->
      <section v-else-if="tab === 'prize'">
        <h3>你的成績</h3>
        <div class="tiles">
          <div class="tile"><span>已抽</span><b>{{ total.toLocaleString() }}<em>次</em></b><small>抽到 {{ Object.keys(counts).length }} 國{{ rerolls ? `・重抽 ${rerolls}` : '' }}</small></div>
          <div class="tile"><span>平均 HDI</span><b>{{ total ? drawnMean.toFixed(3) : '—' }}</b><small>全世界期望 {{ HDI_EXPECT.toFixed(3) }}</small></div>
          <template v-if="total">
            <div class="tile pick" @click="pick(best)"><span>最好</span><b class="sm"><i class="fl" :style="flagStyle(best)"></i>{{ nameOf(best) }}</b><small :style="{ color: `color-mix(in srgb, ${colorOf(best)} 45%, #ffffff)` }">{{ prizeOf(best) }}</small></div>
            <div class="tile pick" @click="pick(worst)"><span>最差</span><b class="sm"><i class="fl" :style="flagStyle(worst)"></i>{{ nameOf(worst) }}</b><small :style="{ color: `color-mix(in srgb, ${colorOf(worst)} 45%, #ffffff)` }">{{ prizeOf(worst) }}</small></div>
          </template>
        </div>

        <h3>獎項<small>HDI {{ meta.hdi.year }} 年・機率 vs 你抽到的</small></h3>
        <ol class="prizes">
          <li v-for="(t, i) in TIERS" :key="t.name" :class="{ on: last && tierIdx(last) === i }" :style="{ '--tier': t.color }">
            <div class="p-top">
              <span class="p-name"><i class="sw"></i>{{ t.name }}</span>
              <span class="p-hdi">HDI {{ t.range }}</span>
              <span class="p-meta">{{ t.n }} 國・{{ t.balls }} 球</span>
            </div>
            <div class="p-bars">
              <div class="p-bar"><i :style="{ width: `${(pTier(t) / maxTierP) * 100}%` }"></i><b>{{ fmtP(pTier(t)) }}</b><small>機率</small></div>
              <div class="p-bar mine"><i :style="{ width: `${total ? ((drawnByTier[i] || 0) / total / maxTierP) * 100 : 0}%` }"></i><b>{{ total ? fmtP((drawnByTier[i] || 0) / total) : '—' }}</b><small>你 {{ drawnByTier[i] || 0 }} 次</small></div>
            </div>
          </li>
        </ol>
        <p class="note">獎越大越難中：每一級的機率盡量接近上一級的 {{ TIER_R }} 倍（1:2:4:…:128）。沒有 HDI 的國家（{{ noHdi.n }} 國、{{ noHdi.balls }} 球）抽到就重抽{{ rerolls ? `，到目前重抽 ${rerolls} 次` : '' }}。</p>

        <template v-if="total">
          <h3>最常投胎到</h3>
          <ol class="rows">
            <li v-for="(c, k) in topDrawn" :key="c.iso" :class="{ on: c.iso === last }" @click="pick(c.iso)">
              <span class="r-n">{{ k + 1 }}</span><i class="fl" :style="flagStyle(c.iso)"></i>
              <span class="r-name">{{ nameOf(c.iso) }}<small><i class="sw" :style="{ background: colorOf(c.iso) }"></i>{{ prizeOf(c.iso) }}</small></span>
              <b class="r-v">{{ c.n.toLocaleString() }} 次<small>{{ fmtP(c.n / total) }}</small></b>
            </li>
          </ol>
        </template>

        <div class="h-row">
          <h3>全部國家<small>{{ meta.count }} 國・{{ BALL_TOTAL }} 球</small></h3>
          <div class="seg" role="group" aria-label="排序">
            <button v-for="s in SORTS" :key="s.key" type="button" :class="{ on: sort === s.key }" @click="sort = s.key">{{ s.label }}</button>
          </div>
        </div>
        <ol class="rows">
          <li v-for="(iso, k) in sorted" :key="iso" :class="{ on: iso === last }" @click="pick(iso)">
            <span class="r-n">{{ k + 1 }}</span><i class="fl" :style="flagStyle(iso)"></i>
            <span class="r-name">{{ nameOf(iso) }}<small><i class="sw" :style="{ background: colorOf(iso) }"></i>{{ prizeOf(iso) }}・HDI {{ C[iso].hdi?.toFixed(3) ?? '—' }}</small></span>
            <b class="r-v">{{ fmtP(mode === 'map' ? C[iso].p : pIso(iso)) }}<small>{{ BALLS[iso] }} 球{{ counts[iso] ? `・中 ${counts[iso]}` : '' }}</small></b>
          </li>
        </ol>
        <p class="note">臺灣：{{ prizeOf('TWN') }}（HDI {{ C.TWN.hdi.toFixed(3) }}），{{ BALLS.TWN }} 顆球，機率 {{ fmtP(pIso('TWN')) }}，大約 {{ oneIn(pIso('TWN')) }} 次投胎才會出生在臺灣一次。1 顆球約 {{ POP_UNIT.toLocaleString() }} 人。</p>
      </section>

      <!-- 說明 -->
      <section v-else>
        <h3>計算方法</h3>
        <p class="formula">
          P<sub>i</sub> = 彩球數<sub>i</sub> ÷ {{ BALL_TOTAL }}<br>
          彩球數<sub>i</sub> ≈ 人口<sub>i</sub> ÷ {{ POP_UNIT.toLocaleString() }}，至少 1 顆<br>
          獎項<sub>i</sub> = HDI<sub>i</sub> 落在哪一段
        </p>
        <ol class="how">
          <li><b>想法</b>出生在哪裡自己選不了，就像抽樂透。全世界每個人當成一張彩券，人越多的國家彩券越多，所以抽到印度、中國的機會最大；抽到後拿到的「獎品」是那個國家的人類發展指數——壽命、教育、所得綜合起來的生活條件。</li>
          <li><b>人口</b>英文維基百科〈List of countries and dependencies by population〉，只看正式國家：聯合國 193 個會員國、梵蒂岡和巴勒斯坦兩個觀察員國，加上臺灣，共 {{ meta.count }} 國。</li>
          <li><b>HDI</b>英文維基百科〈List of countries by Human Development Index〉，數字是 UNDP《2025 人類發展報告》的 {{ meta.hdi.year }} 年 HDI。臺灣不在 UNDP 資料裡，用英文維基 Taiwan 條目資訊框的 {{ C.TWN.hdi }}（2023 年）。北韓用中文維基資訊框的 {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。摩納哥、梵蒂岡沒有 HDI，抽到算「重抽」。</li>
          <li><b>獎項</b>把國家照 HDI 由高到低排，切成 {{ TIERS.length }} 段，每一級的中獎機率都比上一級大，盡量接近 1:2:4:8:16:32:64:128；同一個 HDI 不拆開，所以只能接近，不會剛好。</li>
          <li><b>彩球</b>總共 {{ BALL_TOTAL }} 顆，每國至少 1 顆（{{ ONE_BALL }} 國只有 1 顆）；其他國家 1 顆＝平均 {{ POP_UNIT.toLocaleString() }} 人，印度最多（{{ BALLS.IND }} 顆）。人口很少的國家也有 1 顆，抽中的機會比人口比例高。</li>
          <li><b>地圖模式</b>國家照獎項填色；抽籤照人口比例，抽過的國家畫投胎紀錄圓，圓面積＝這一國抽中的次數佔全部的幾成，抽得越多越接近各國人口比例。地圖用 Natural Earth 1:5,000 萬國界、Esri 深灰底圖。</li>
          <li><b>彩球模式</b>每國的球排成一塊，放在那一國本土的中心（Natural Earth 的國名標籤點），國家靠得近的地方（歐洲、中東）球會疊在一起。抽一顆球，所以機率是球數比例。球面是國旗。</li>
          <li><b>排列模式</b>同一批球照獎項從左上一列一列排到右下：特獎在最上面，哈哈獎在最下面，最後是重抽的灰色球；同一級裡 HDI 高的在前，同一國的球排在一起。每一級佔的面積就是它的球數。</li>
          <li><b>格子模式</b>跟排列模式同一組格子（{{ cellMeta.cols }} 欄 × {{ cellMeta.rows }} 列＝{{ BALL_TOTAL }} 格，一格一顆），但照各國的相對位置放：遞迴對切，同一洲的國家在一起，同一國的球連成方正的一塊。點一顆球、再點另一顆可以交換（換過的記在這台裝置）。</li>
          <li><b>盒子模式</b>把格子模式的排法做成 3D 的透明壓克力收納盒、蓋子打開；「盒子・照獎」照排列模式的順序，每一獎用隔板隔開、鋪不同的淡色。抽到的那顆浮起來放大。</li>
          <li><b>搖獎機（遊戲模式）</b>{{ BALL_TOTAL }} 顆球放進 3D 的透明滾筒，抽到哪一顆全部照物理模擬決定。滾筒轉起來（每次轉的時間乘 0.85～1.15 的亂數），筒裡三片擋板把球帶上去再翻下來；停下來後出球口轉到正下方、打開閘門，哪一顆球靠重力先穿過洞口就是抽到的，沿著滑道滾進前面的盤子。掉出來的是重抽球就再搖一次。</li>
        </ol>

        <h3>網址</h3>
        <p class="card"><a class="url" :href="SITE" target="_blank" rel="noopener">{{ SITE }}</a></p>

        <h3>資料來源</h3>
        <ul class="src">
          <li v-for="s in SOURCES" :key="s.label"><b>{{ s.label }}</b>{{ s.org }}<a :href="s.url" target="_blank" rel="noopener">{{ s.url }}</a></li>
        </ul>
      </section>
    </main>
    </aside>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import LotteryDrum from './components/LotteryDrum.vue'
import LotteryBox from './components/LotteryBox.vue'
import MapModes from './components/MapModes.vue'
import WorldLocator from './components/WorldLocator.vue'
import {
  MODES, MAP_MODES, mode, drawOne, drawBall, cellMeta, cellsSnap, swaps, swapPick, undoSwap, resetSwaps, swapsText, boxRank,
  meta, C, ISOS, BALLS, BALL_TOTAL, POP_UNIT, ONE_BALL, balls, isoOfBall, colors, flagMeta, flagsUrl, flagStyle, ballTip,
  TIERS, TIER_EN, TIER_EN_FULL, TIER_R, NODATA, noHdi, noHdiNames, tierIdx, tierOfHdi, nameOf, prizeOf, colorOf,
  HDI_EXPECT, pTier, pIso, fmtP, oneIn,
} from './lottery.js'

const SOURCES = [
  { label: '人類發展指數 HDI（UNDP《2025 人類發展報告》，2023 年）', org: '英文維基百科 List of countries by Human Development Index', url: 'https://en.wikipedia.org/wiki/List_of_countries_by_Human_Development_Index' },
  { label: '各國人口', org: '英文維基百科 List of countries and dependencies by population', url: 'https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population' },
  { label: '臺灣 HDI（UNDP 不含臺灣）', org: '英文維基百科 Taiwan 條目資訊框', url: 'https://en.wikipedia.org/wiki/Taiwan' },
  { label: '北韓 HDI（UNDP 沒算，2016 年）', org: '中文維基百科「朝鲜民主主义人民共和国」條目資訊框', url: 'https://zh.wikipedia.org/wiki/朝鲜民主主义人民共和国' },
  { label: '國旗（1:1 正方形 SVG，7.6.0）', org: 'flag-icons（MIT）', url: 'https://github.com/lipis/flag-icons' },
  { label: '國界（1:50m Admin 0 – Countries）', org: 'Natural Earth（公有領域）', url: 'https://www.naturalearthdata.com/' },
]
// 實際網頁
const SITE = 'https://szfftz.github.io/birth-lottery/'
const HINTS = {
  game: '兩指縮放；點一顆球看是哪一國。',
  map: '拖曳、兩指縮放地圖；點一個國家看機率和 HDI。',
  balls: '拖曳、兩指縮放地圖，球跟著變大；點一顆球看是哪一國。',
  grid: '點一顆球看是哪一國。',
  cells: '點一顆球、再點另一顆，兩顆交換格子。',
  box: '兩指縮放；點一顆球看是哪一國。',
  boxp: '兩指縮放；點一顆球看是哪一國。',
}

const face = 'flag' // 球面一律國旗

// 舞台蓋滿整個畫面：上面狀態列、下面浮動操作列擋住的高度（px），傳給各模式把內容放在看得到的地方
const phoneEl = ref(null), dockEl = ref(null), safeTopEl = ref(null)
const insets = reactive({ top: 0, bottom: 0 })
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
const TABS = [{ key: 'result', label: '結果' }, { key: 'history', label: '歷史' }, { key: 'prize', label: '獎項' }, { key: 'about', label: '說明' }]
const tab = ref('result')
// 資訊面板：開關、往下拖的距離（拖超過 80px 就收起來）
const sheet = ref(false)
function openSheet(t) {
  if (t) tab.value = t
  sheet.value = true
}
const dragY = ref(0)
let drag0 = null
function dragStart(e) {
  if (e.target.closest('button')) return
  drag0 = e.clientY
  e.currentTarget.setPointerCapture(e.pointerId)
}
function dragMove(e) { if (drag0 != null) dragY.value = Math.max(0, e.clientY - drag0) }
function dragEnd() {
  if (drag0 == null) return
  if (dragY.value > 80) sheet.value = false
  drag0 = null
  dragY.value = 0
}
const SORTS = [{ key: 'pop', label: '照機率' }, { key: 'hdi', label: '照 HDI' }]
const sort = ref('pop')
const sorted = computed(() => (sort.value === 'pop' ? ISOS : [...ISOS].sort((a, b) => (C[b].hdi ?? -1) - (C[a].hdi ?? -1))))
const maxTierP = Math.max(...TIERS.map((t) => pTier(t)))
// 地圖類模式第一次切過去才載入 MapLibre，之後一直留著
const mapUsed = ref(false)
const menu = ref(false) // 模式選單開著沒
function setMode(m) {
  if (spinning.value) return
  mode.value = m
  if (MAP_MODES.includes(m)) mapUsed.value = true
  // 抽到的那顆球留著（切模式也一樣），下一次抽才換
}
// 點清單：只把它標成「這次」，不算一次投胎
function pick(iso) {
  lastRerolls.value = 0
  last.value = iso
  lastBall.value = null
}
const copiedSwaps = ref(false)
async function copySwaps() {
  await navigator.clipboard.writeText(swapsText())
  copiedSwaps.value = true
  setTimeout(() => (copiedSwaps.value = false), 1500)
}

// 國旗拼圖（three.js 貼圖用）
const atlas = ref(null)
fetch(flagsUrl).then((r) => r.blob()).then(createImageBitmap).then((a) => (atlas.value = a))

const counts = reactive({})
const history = reactive([]) // 每一次抽的結果：{ n, iso, ball, time }
const historyDesc = computed(() => history.slice().reverse())
const total = ref(0)
const last = ref(null)
const lastBall = ref(null)
const rerolls = ref(0) // 抽到沒有 HDI 的國家（摩納哥、梵蒂岡）就自動再搖，不算投胎次數
const lastRerolls = ref(0)
const drum = ref(null)
const spinning = ref(false)

// 遊戲模式：搖獎機轉完、掉出來的那顆就是（抽到誰由物理模擬決定）；地圖模式照人口抽一國；其他模式從全部球裡抽一顆
async function draw() {
  if (spinning.value) return
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
  history.push({ n: total.value, iso, ball: b ?? null, time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) })
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
  position: relative; width: 100%; max-width: 430px; height: 100vh; height: 100dvh; margin: 0 auto; overflow: hidden; background: #08061a; }
@media (min-width: 600px) {
  .phone { height: min(932px, calc(100dvh - 48px)); margin: 24px auto; border-radius: 36px;
    box-shadow: 0 0 0 10px #0b0b0b, 0 0 0 11px #333, 0 30px 80px rgba(0, 0, 0, 0.6); }
}
.safe-top { position: absolute; top: 0; height: env(safe-area-inset-top); width: 0; visibility: hidden; }
.stage-wrap { position: absolute; inset: 0; overflow: hidden; background: #08061a; }
/* 玻璃：操作列、選單、結果卡 */
.glass { background: var(--glass); border: 1px solid var(--glass-line); -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: blur(18px) saturate(1.6);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08); }

/* 載入中：紫→粉→黃的舞台色，一顆彈跳的球 */
.loading { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  background: radial-gradient(120% 70% at 50% 45%, #4a2a96 0%, #23145a 40%, #08061a 100%); color: #fff; }
.ld-ball { width: 56px; height: 56px; animation: ld-bounce 0.7s cubic-bezier(0.3, 0, 0.6, 1) infinite alternate; }
.ld-ball i { display: block; width: 100%; height: 100%; border-radius: 50%; animation: ld-spin 1.4s linear infinite;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.9) 0 10%, transparent 34%), conic-gradient(#ff2e88 0 25%, #ffd23f 0 50%, #19d3c5 0 75%, #ff8a00 0); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4); }
@keyframes ld-bounce { from { transform: translateY(-18px); } to { transform: translateY(6px) scaleY(0.94); } }
@keyframes ld-spin { to { transform: rotate(360deg); } }
.ld-title { margin-top: 14px; font-size: 26px; font-weight: 900; letter-spacing: 0.04em;
  background: linear-gradient(180deg, #fffbe8, #f4c04a 55%, #b97d17 60%, #fff1b8); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 12px rgba(255, 200, 90, 0.5)); }
.ld-sub { font-size: 13px; color: rgba(255, 255, 255, 0.7); letter-spacing: 0.1em; }

/* ── 操作列（浮動玻璃條） ── */
.dock { position: absolute; z-index: 12; left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); display: flex; gap: 8px; align-items: center; padding: 8px; border-radius: 26px; }
.ibtn { position: relative; flex: none; display: grid; place-items: center; width: 52px; height: 52px; padding: 0; border: 1px solid var(--glass-line); border-radius: 18px;
  background: rgba(255, 255, 255, 0.07); color: #fff; cursor: pointer; transition: background 0.15s, transform 0.1s; }
.ibtn:active:not(:disabled) { transform: scale(0.94); }
.ibtn.on { background: var(--gold); color: #2a1a05; }
.ibtn:disabled { opacity: 0.4; cursor: default; }
.badge { position: absolute; top: -5px; right: -5px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; background: var(--gold); color: #161616;
  font-size: 12px; font-weight: 800; line-height: 20px; text-align: center; box-shadow: 0 0 0 2px rgba(20, 20, 24, 0.9); }
/* DRAW：街機按鈕（金框、紅色圓頂、按下去會陷下去） */
.draw { flex: 1; height: 52px; padding: 3px; border: 0; border-radius: 18px; cursor: pointer; font: inherit;
  background: linear-gradient(160deg, #fff3c4, #d9a72e 45%, #8a6414); box-shadow: 0 4px 0 #5a420b, 0 8px 18px rgba(0, 0, 0, 0.35); transition: transform 0.08s, box-shadow 0.08s; }
.d-dome { position: relative; display: flex; align-items: center; justify-content: center; gap: 2px; height: 100%; border-radius: 15px; overflow: hidden;
  background: radial-gradient(ellipse 70% 140% at 40% 0%, #ff8a8a 0%, #e0142a 48%, #8a0612 100%); color: #fff;
  box-shadow: inset 0 -6px 10px rgba(0, 0, 0, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.45); }
.d-dome::after { content: ''; position: absolute; top: -40%; bottom: -40%; left: -60px; width: 40px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent); animation: d-sweep 3.2s ease-in-out infinite; }
@keyframes d-sweep { 0%, 60% { left: -60px; } 100% { left: 110%; } }
.d-dome b { font-size: 22px; font-weight: 900; letter-spacing: 0.12em; text-shadow: 0 2px 0 rgba(90, 0, 10, 0.5); }
.draw:active:not(:disabled), .draw.busy { transform: translateY(3px); box-shadow: 0 1px 0 #5a420b, 0 4px 10px rgba(0, 0, 0, 0.35); }
.draw:disabled { cursor: default; }
.draw:disabled:not(.busy) { filter: grayscale(0.6) brightness(0.8); }
.draw.busy .d-dome { animation: d-glow 0.5s ease-in-out infinite alternate; }
.draw.busy .d-dome b { font-size: 17px; }
@keyframes d-glow { to { filter: brightness(1.3); } }
.d-dots { display: inline-flex; gap: 3px; margin-left: 4px; }
.d-dots i { width: 4px; height: 4px; border-radius: 50%; background: #fff; animation: d-dot 0.9s ease-in-out infinite; }
.d-dots i:nth-child(2) { animation-delay: 0.15s; }
.d-dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes d-dot { 0%, 100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }

/* 模式選單：從漢堡往上展開 */
.modes { position: relative; flex: none; }
.menu { position: absolute; left: -8px; bottom: calc(100% + 18px); z-index: 13; min-width: 190px; margin: 0; padding: 6px; list-style: none; border-radius: 20px;
  background: rgba(18, 13, 43, 0.86); transform-origin: 26px 100%; }
.menu button { display: flex; align-items: center; gap: 12px; width: 100%; height: 44px; padding: 0 14px; border: 0; border-radius: 14px; background: none;
  color: rgba(255, 255, 255, 0.72); font: inherit; font-size: 15px; text-align: left; cursor: pointer; white-space: nowrap; }
.menu button:hover { background: rgba(255, 255, 255, 0.06); }
.m-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; opacity: 0.6; }
.menu button.on { background: rgba(245, 196, 81, 0.16); color: #fff; font-weight: 700; }
.menu button.on .m-dot { border: 0; background: var(--gold); opacity: 1; box-shadow: 0 0 8px var(--gold); }
.menu-scrim { position: absolute; inset: 0; z-index: 11; background: rgba(0, 0, 0, 0.25); }
.menu-enter-active, .menu-leave-active { transition: opacity 0.16s, transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: scale(0.85) translateY(10px); }

/* ── 舞台下緣（操作列上面）浮著的東西 ── */
.stage-foot { position: absolute; left: 12px; right: 12px; z-index: 4; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.stage-foot > * { pointer-events: auto; }
.swap { display: flex; gap: 6px; align-items: center; padding: 6px 6px 6px 14px; border-radius: 18px; }
.swap-hint { flex: 1; font-size: 13px; color: rgba(255, 255, 255, 0.75); }
.pill { height: 34px; padding: 0 12px; border: 1px solid var(--glass-line); border-radius: 12px; background: rgba(255, 255, 255, 0.08); color: #fff; font: inherit; font-size: 13px; cursor: pointer; }
.pill:disabled { opacity: 0.4; cursor: default; }
/* 結果卡（遊戲以外的模式）：左邊一條獎項色 */
.chip { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px 10px 10px; border-radius: 20px; overflow: hidden;
  color: #fff; font: inherit; text-align: left; cursor: pointer; }
.chip::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--tier) 30%, transparent), transparent 70%); pointer-events: none; }
.c-flag { position: relative; flex: none; width: 44px; height: 44px; border-radius: 50%; box-shadow: 0 0 0 2px #fff3c4, 0 0 0 3.5px #c99a2e, 0 4px 10px rgba(0, 0, 0, 0.4); }
.c-main, .c-prize { position: relative; min-width: 0; line-height: 1.25; }
.c-main { flex: 1; }
.c-main b { display: block; font-size: 17px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-main small, .c-prize small { display: block; margin-top: 1px; font-size: 12px; color: rgba(255, 255, 255, 0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-prize { flex: none; text-align: right; }
.c-prize b { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--tier); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); font-size: 13px; font-weight: 800; }
.c-go { position: relative; flex: none; color: rgba(255, 255, 255, 0.45); }
.chip-enter-active { transition: opacity 0.3s, transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
.chip-leave-active { transition: opacity 0.15s; position: absolute; left: 0; right: 0; bottom: 0; }
.chip-enter-from { opacity: 0; transform: translateY(20px) scale(0.92); }
.chip-leave-to { opacity: 0; }

/* ── 資訊面板 ── */
.scrim { position: absolute; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px); }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 21; display: flex; flex-direction: column; max-height: 86%; border-radius: 28px 28px 0 0;
  background: var(--panel); box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08); transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
.sheet-head { flex: none; padding: 8px 16px 10px; touch-action: none; cursor: grab; }
.grip { display: block; width: 38px; height: 5px; margin: 0 auto 10px; border-radius: 3px; background: rgba(255, 255, 255, 0.22); }
.sh-row { display: flex; gap: 8px; align-items: center; }
.tabs { flex: 1; display: flex; padding: 3px; border-radius: 14px; background: var(--tile); }
.tabs button { flex: 1; height: 36px; border: 0; border-radius: 11px; background: none; color: rgba(255, 255, 255, 0.68); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s, color 0.15s; }
.tabs button.on { background: linear-gradient(180deg, #ffe08a, var(--gold)); color: #2a1a05; font-weight: 800; box-shadow: 0 2px 8px rgba(245, 196, 81, 0.3); }
.close { flex: none; display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; background: var(--tile); color: rgba(255, 255, 255, 0.75); cursor: pointer; }
.sheet .content { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.sheet-enter-active, .sheet-leave-active { transition: transform 0.32s cubic-bezier(0.2, 0.9, 0.3, 1); }
.sheet-enter-from, .sheet-leave-to { transform: translateY(100%); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.content { padding: 6px 16px calc(28px + env(safe-area-inset-bottom)); font-size: 14px; line-height: 1.6; }
h3 { display: flex; align-items: baseline; gap: 8px; margin: 22px 2px 10px; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.9); }
h3 small { font-size: 13px; font-weight: 500; color: var(--dim); letter-spacing: 0; }
section > h3:first-child { margin-top: 8px; }
.h-row { display: flex; align-items: center; justify-content: space-between; margin: 22px 2px 10px; }
.h-row h3 { margin: 0; }
.hint { display: flex; gap: 6px; align-items: center; margin: 14px 2px 0; font-size: 13px; color: var(--dim); }
.hint svg { flex: none; }
.note { margin: 10px 2px 0; font-size: 13px; line-height: 1.6; color: var(--muted); }
.card { margin: 0; padding: 12px 14px; border-radius: 16px; background: var(--tile); }
.card.flush { padding: 4px 10px; }
.url { color: var(--teal); word-break: break-all; text-decoration: none; }

/* 結果：票卡（上面獎項色光暈） */
.ticket { position: relative; padding: 16px; border-radius: 22px; overflow: hidden;
  background: linear-gradient(180deg, color-mix(in srgb, var(--tier) 28%, var(--tile)) 0%, var(--tile) 55%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tier) 45%, transparent); }
.t-head { display: flex; gap: 14px; align-items: center; }
.t-flag { flex: none; width: 68px; height: 68px; border-radius: 50%; box-shadow: 0 0 0 3px #fff3c4, 0 0 0 5px #c99a2e, 0 8px 18px rgba(0, 0, 0, 0.4); }
.t-who { min-width: 0; }
.t-title { font-size: 13px; color: rgba(255, 255, 255, 0.65); }
.t-name { font-size: 26px; font-weight: 900; line-height: 1.15; }
.t-en { font-size: 13px; color: rgba(255, 255, 255, 0.6); }
.t-prize { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin: 16px 0 14px; }
.t-badge { padding: 3px 14px; border-radius: 999px; background: var(--tier); color: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); font-size: 20px; font-weight: 900; box-shadow: 0 4px 14px color-mix(in srgb, var(--tier) 45%, transparent); }
.t-pen { font-size: 14px; font-weight: 800; color: color-mix(in srgb, var(--tier) 45%, #ffffff); }
.t-range { width: 100%; font-size: 13px; color: rgba(255, 255, 255, 0.68); }
/* 數字小卡：兩欄 */
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tile { display: flex; flex-direction: column; min-width: 0; padding: 10px 12px; border-radius: 14px; background: rgba(255, 255, 255, 0.05); }
section > .tiles .tile { background: var(--tile); }
.ticket .tile { background: rgba(0, 0, 0, 0.22); }
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
.p-top { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.p-name { display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 800; }
.p-name .sw { background: var(--tier); }
.p-hdi { font-size: 13px; color: var(--muted); }
.p-meta { margin-left: auto; font-size: 13px; color: var(--dim); }
.p-bars { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
.p-bar { position: relative; display: flex; align-items: center; gap: 8px; height: 22px; padding: 0 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); overflow: hidden; }
.p-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; background: color-mix(in srgb, var(--tier) 70%, transparent); transition: width 0.4s; }
.p-bar.mine i { background: linear-gradient(90deg, #b8871f, var(--gold)); }
.p-bar b { position: relative; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.p-bar small { position: relative; margin-left: auto; font-size: 12px; color: #ffffff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6); }
.t-map { margin: 14px 0 4px; }
.rb-map { position: relative; margin-top: 12px; }
/* ── 舞台上的結果看板（Day 25 原樣，1080×1350 的單位） ── */
.rb-wrap { position: relative; cursor: pointer; animation: rb-pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1); }
@keyframes rb-pop { 0% { transform: scale(0.2) rotate(-6deg); } 60% { transform: scale(1.08) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
.rb-burst { position: absolute; left: 50%; top: 50%; width: 900px; height: 900px; margin: -450px 0 0 -450px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--tier) 70%, #fff3b0) 0deg 9deg, rgba(255, 230, 140, 0) 9deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 62%); mask: radial-gradient(circle, #000 18%, transparent 62%);
  opacity: 0.75; animation: rb-spin 14s linear infinite; }
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
.rb-body { position: relative; display: flex; align-items: center; gap: 18px; }
.rb-ball { flex: none; padding: 4px; border-radius: 50%; background: linear-gradient(145deg, #fff3c4, #c99a2e); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4); }
.rb-flag { position: relative; width: 110px; height: 110px; border-radius: 50%; overflow: hidden; }
.rb-flag::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 32%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.35) 100%); }
.rb-main { flex: 1; min-width: 0; }
.rb-name { font-family: 'Overpass', sans-serif; font-size: 54px; font-weight: 900; line-height: 1.05; transform: skewX(-10deg); color: #ffffff;
  -webkit-text-stroke: 6px #2b0a5e; paint-order: stroke fill; text-shadow: 4px 4px 0 #2b0a5e; }
.rb-medal { position: relative; flex: none; width: 128px; height: 128px; transform-origin: 50% -20px; animation: md-swing 2.6s ease-in-out infinite; }
@keyframes md-swing { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
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
  color: #ffffff; text-shadow: 0 0 2px #2b0a5e, 0 2px 0 #2b0a5e; font-family: 'Overpass', sans-serif; line-height: 1; }
.md-face::after { content: ''; position: absolute; top: -30%; bottom: -30%; width: 26px; left: -40px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent); animation: md-glint 3s ease-in-out infinite; }
@keyframes md-glint { 0%, 55% { left: -40px; } 85%, 100% { left: 120%; } }
.md-face em { font-style: normal; font-size: 20px; letter-spacing: 0.05em; color: #fff3b0; }
.md-face b { margin: 0 0 2px; font-size: 34px; font-weight: 900; letter-spacing: 0.02em; }
.md-face.long b { font-size: 26px; }
.md-face small { font-size: 20px; font-weight: 800; letter-spacing: 0.2em; }
@keyframes rb-spin { to { transform: rotate(360deg); } }
.board-enter-active { transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
.board-leave-active { transition: opacity 0.15s ease; }
.board-enter-from { opacity: 0; transform: translateY(30px) scale(0.8); }
.board-leave-to { opacity: 0; }
</style>
