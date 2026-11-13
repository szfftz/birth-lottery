<template>
  <!-- 投胎樂透（手機版）：上面是 3D 樂透搖獎機（Day 25 的遊戲模式），下面分頁看結果、統計、獎項、說明
       電腦上也是手機寬度（.phone 最寬 430px，置中） -->
  <div class="phone">
    <LotteryDrum ref="drum" :balls="balls" :colors="colors" :atlas="atlas" :grid="[flagMeta.cols, flagMeta.rows]" v-if="atlas"
      :face="face" :sel="lastBall" :tip-of="ballTip" :party="spinning ? 0 : total" :spinning="spinning" @draw="draw">
      <!-- 抽完在搖獎機下面顯示結果看板（國旗、英文國名、獎牌） -->
      <Transition name="board">
        <div v-if="last && !spinning && lastBall != null" :key="total" class="rb-wrap" :style="{ '--tier': colorOf(last) }">
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
                    <em>{{ tierIdx(last) === 0 ? '★★★' : tierIdx(last) === TIERS.length - 1 ? '☺' : '★' }}</em>
                    <b>{{ TIER_EN[tierIdx(last)] }}</b><small>PRIZE</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </LotteryDrum>
    <div v-else class="loading">載入中…</div>

    <!-- 操作列：抽一次、重來、球面 -->
    <div class="bar">
      <button type="button" class="btn main" :disabled="spinning || !atlas" @click="draw">{{ spinning ? '搖獎中…' : '抽一次' }}</button>
      <button type="button" class="btn" :disabled="spinning || !total" @click="reset">重來</button>
      <div class="seg" role="group" aria-label="球面">
        <button v-for="f in FACES" :key="f.key" type="button" :class="{ on: face === f.key }" @click="face = f.key">{{ f.label }}</button>
      </div>
    </div>

    <nav class="tabs">
      <button v-for="t in TABS" :key="t.key" type="button" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
    </nav>

    <main class="content">
      <!-- 結果 -->
      <section v-if="tab === 'result'">
        <template v-if="last && !spinning">
          <div class="ticket" :style="{ borderColor: colorOf(last) }">
            <div class="t-head">
              <div class="t-flag" :style="flagStyle(last)"></div>
              <div>
                <div class="t-title">第 {{ total.toLocaleString() }} 次投胎：你出生在</div>
                <div class="t-name">{{ nameOf(last) }}<small>{{ C[last].name_en }}</small></div>
              </div>
            </div>
            <div class="t-prize" :style="{ color: colorOf(last) }">{{ prizeOf(last) }} <span class="t-en">{{ TIER_EN_FULL[tierIdx(last)] }}</span><small>HDI {{ TIERS[tierIdx(last)].range }}</small></div>
            <dl class="t-nums">
              <div><dt>HDI</dt><dd>{{ C[last].hdi.toFixed(3) }}</dd><small>{{ C[last].hdi_rank ? `UNDP 第 ${C[last].hdi_rank} 名` : '不在 UNDP 排名' }}</small></div>
              <div><dt>抽到這一獎</dt><dd>{{ fmtP(pTier(TIERS[tierIdx(last)])) }}</dd><small>約 1/{{ oneIn(pTier(TIERS[tierIdx(last)])) }}</small></div>
              <div><dt>抽到這一國</dt><dd>{{ fmtP(pIso(last)) }}</dd><small>約 1/{{ oneIn(pIso(last)) }}</small></div>
              <div><dt>球號</dt><dd>{{ (lastBall + 1).toLocaleString() }}</dd><small>這國 {{ BALLS[last] }} 顆／共 {{ BALL_TOTAL }} 顆</small></div>
              <div class="wide"><dt>人口</dt><dd>{{ C[last].pop.toLocaleString() }}</dd><small>{{ C[last].pop_date }}</small></div>
            </dl>
            <p v-if="lastRerolls" class="hint">先掉出 {{ lastRerolls }} 次重抽球（{{ noHdiNames }}），自動再搖</p>
          </div>
        </template>
        <p v-else-if="spinning" class="hint big">搖獎中…等球掉進盤子</p>
        <p v-else class="hint big">按舞台上的紅色 DRAW 或「抽一次」開始投胎。{{ BALL_TOTAL }} 顆球裡掉出哪一顆，全部照物理模擬決定；抽中的機率＝那一國的球數 ÷ 全部球數。</p>
        <p class="hint">拖曳舞台可以轉鏡頭、兩指縮放；點一顆球看是哪一國。</p>
      </section>

      <!-- 統計 -->
      <section v-else-if="tab === 'stats'">
        <h3>總數統計</h3>
        <dl class="stats">
          <dt>國家</dt><dd>{{ meta.count }} 國<small>有獎 {{ meta.count - noHdi.n }}・重抽 {{ noHdi.n }}</small></dd>
          <dt>人口</dt><dd>{{ meta.total.toLocaleString() }} 人</dd>
          <dt>獎項</dt><dd>{{ TIERS.length }} 級<small>{{ TIERS[0].name }}～{{ TIERS.at(-1).name }}</small></dd>
          <dt>彩球</dt><dd>{{ BALL_TOTAL.toLocaleString() }} 顆<small>1 顆約 {{ POP_UNIT.toLocaleString() }} 人</small></dd>
          <dt>已抽</dt><dd>{{ total.toLocaleString() }} 次<small>抽到 {{ Object.keys(counts).length }} 國</small></dd>
          <template v-if="total">
            <dt>重抽球</dt><dd>{{ rerolls.toLocaleString() }} 次<small>不算</small></dd>
            <dt>平均 HDI</dt><dd>{{ drawnMean.toFixed(3) }}<small>期望值 {{ HDI_EXPECT.toFixed(3) }}（{{ TIERS[tierOfHdi(HDI_EXPECT)].name }}）</small></dd>
            <dt>最好</dt><dd>{{ best ? `${prizeOf(best)}・${nameOf(best)}` : '—' }}</dd>
            <dt>最差</dt><dd>{{ worst ? `${prizeOf(worst)}・${nameOf(worst)}` : '—' }}</dd>
          </template>
        </dl>

        <template v-if="total">
          <h3>最常投胎到</h3>
          <ol class="list">
            <li v-for="c in topDrawn" :key="c.iso" :class="{ on: c.iso === last }">
              <span>{{ nameOf(c.iso) }}<i class="sw" :style="{ background: colorOf(c.iso) }"></i><small>{{ prizeOf(c.iso) }}</small></span><b>{{ c.n.toLocaleString() }} 次</b>
            </li>
          </ol>
        </template>

        <h3>機率最高的 10 國（佔 {{ fmtP(top10p) }}）</h3>
        <ol class="list">
          <li v-for="iso in TOP" :key="iso" :class="{ on: iso === last }">
            <span>{{ nameOf(iso) }}<i class="sw" :style="{ background: colorOf(iso) }"></i><small>{{ prizeOf(iso) }}</small></span><b>{{ fmtP(pIso(iso)) }}</b>
          </li>
        </ol>
        <p class="hint">臺灣：{{ prizeOf('TWN') }}（HDI {{ C.TWN.hdi.toFixed(3) }}），{{ BALLS.TWN }} 顆球，機率 {{ fmtP(pIso('TWN')) }}，大約 {{ oneIn(pIso('TWN')) }} 次投胎才會出生在臺灣一次。</p>
      </section>

      <!-- 獎項 -->
      <section v-else-if="tab === 'prize'">
        <h3>獎項：HDI（{{ meta.hdi.year }} 年）・中獎機率</h3>
        <table class="tally">
          <thead><tr><th>獎</th><th>HDI</th><th class="r">國</th><th class="r">機率</th><th class="r">球</th><th class="r">抽中</th></tr></thead>
          <tbody>
            <tr v-for="(t, i) in TIERS" :key="t.name">
              <td><i class="sw" :style="{ background: t.color }"></i>{{ t.name }}</td>
              <td class="dim">{{ t.range }}</td>
              <td class="r">{{ t.n }}</td>
              <td class="r">{{ fmtP(pTier(t)) }}</td>
              <td class="r dim">{{ t.balls }}</td>
              <td class="r">{{ drawnByTier[i] || '' }}</td>
            </tr>
            <tr>
              <td><i class="sw" :style="{ background: NODATA }"></i>重抽</td>
              <td class="dim">沒有 HDI</td>
              <td class="r">{{ noHdi.n }}</td>
              <td class="r dim">—</td>
              <td class="r dim">{{ noHdi.balls }}</td>
              <td class="r">{{ rerolls || '' }}</td>
            </tr>
            <tr class="sum"><td>合計</td><td></td><td class="r">{{ meta.count }}</td><td class="r">100%</td><td class="r">{{ BALL_TOTAL }}</td><td class="r">{{ total || '' }}</td></tr>
          </tbody>
        </table>
        <p class="hint">獎越大越難中：每一級的機率盡量接近上一級的 {{ TIER_R }} 倍（1:2:4:…:128）。</p>

        <h3>全部國家</h3>
        <div class="seg small" role="group" aria-label="排序">
          <button v-for="s in SORTS" :key="s.key" type="button" :class="{ on: sort === s.key }" @click="sort = s.key">{{ s.label }}</button>
        </div>
        <ol class="list all">
          <li v-for="iso in sorted" :key="iso" :class="{ on: iso === last }">
            <span>{{ nameOf(iso) }}<i class="sw" :style="{ background: colorOf(iso) }"></i><small>{{ prizeOf(iso) }}・HDI {{ C[iso].hdi?.toFixed(3) ?? '—' }}</small></span><b>{{ BALLS[iso] }} 顆{{ counts[iso] ? `・中 ${counts[iso]}` : '' }}</b>
          </li>
        </ol>
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
          <li><b>想法</b>：出生在哪裡自己選不了，就像抽樂透。全世界每個人當成一張彩券，人越多的國家彩券越多，所以抽到印度、中國的機會最大；抽到後拿到的「獎品」是那個國家的人類發展指數——壽命、教育、所得綜合起來的生活條件。</li>
          <li><b>人口</b>：英文維基百科〈List of countries and dependencies by population〉，只看正式國家：聯合國 193 個會員國、梵蒂岡和巴勒斯坦兩個觀察員國，加上臺灣，共 {{ meta.count }} 國。</li>
          <li><b>HDI</b>：英文維基百科〈List of countries by Human Development Index〉，數字是 UNDP《2025 人類發展報告》的 {{ meta.hdi.year }} 年 HDI。臺灣不在 UNDP 資料裡，用英文維基 Taiwan 條目資訊框的 {{ C.TWN.hdi }}（2023 年）。北韓用中文維基資訊框的 {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。摩納哥、梵蒂岡沒有 HDI，抽到算「重抽」。</li>
          <li><b>獎項</b>：把國家照 HDI 由高到低排，切成 {{ TIERS.length }} 段，每一級的中獎機率都比上一級大，盡量接近 1:2:4:8:16:32:64:128；同一個 HDI 不拆開，所以只能接近，不會剛好。</li>
          <li><b>彩球</b>：總共 {{ BALL_TOTAL }} 顆，每國至少 1 顆（{{ ONE_BALL }} 國只有 1 顆）；其他國家 1 顆＝平均 {{ POP_UNIT.toLocaleString() }} 人，印度最多（{{ BALLS.IND }} 顆）。人口很少的國家也有 1 顆，抽中的機會比人口比例高。</li>
          <li><b>搖獎機</b>：{{ BALL_TOTAL }} 顆球放進 3D 的透明滾筒，抽到哪一顆全部照物理模擬決定。滾筒轉起來（每次轉的時間乘 0.85～1.15 的亂數），筒裡三片擋板把球帶上去再翻下來；停下來後出球口轉到正下方、打開閘門，哪一顆球靠重力先穿過洞口就是抽到的，沿著滑道滾進前面的盤子。掉出來的是重抽球就再搖一次。</li>
        </ol>

        <h3>資料來源</h3>
        <ul class="src">
          <li v-for="s in SOURCES" :key="s.label">{{ s.label }}：{{ s.org }}<br><a :href="s.url" target="_blank" rel="noopener">{{ s.url }}</a></li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import LotteryDrum from './components/LotteryDrum.vue'
import {
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
]

const FACES = [{ key: 'flag', label: '國旗' }, { key: 'prize', label: '獎項色' }]
const face = ref('flag')
const TABS = [{ key: 'result', label: '結果' }, { key: 'stats', label: '統計' }, { key: 'prize', label: '獎項' }, { key: 'about', label: '說明' }]
const tab = ref('result')
const SORTS = [{ key: 'pop', label: '照球數' }, { key: 'hdi', label: '照 HDI' }]
const sort = ref('pop')
const sorted = computed(() => (sort.value === 'pop' ? ISOS : [...ISOS].sort((a, b) => (C[b].hdi ?? -1) - (C[a].hdi ?? -1))))
const TOP = ISOS.slice(0, 10)
const top10p = TOP.reduce((s, iso) => s + pIso(iso), 0)

// 國旗拼圖（three.js 貼圖用）
const atlas = ref(null)
fetch(flagsUrl).then((r) => r.blob()).then(createImageBitmap).then((a) => (atlas.value = a))

const counts = reactive({})
const total = ref(0)
const last = ref(null)
const lastBall = ref(null)
const rerolls = ref(0) // 抽到沒有 HDI 的國家（摩納哥、梵蒂岡）就自動再搖，不算投胎次數
const lastRerolls = ref(0)
const drum = ref(null)
const spinning = ref(false)

// 搖獎機轉完、掉出來的那顆就是（抽到誰由物理模擬決定）
async function draw() {
  if (spinning.value || !drum.value) return
  spinning.value = true
  tab.value = 'result'
  let iso, b, n = 0
  for (;;) {
    b = await drum.value.play()
    iso = isoOfBall(b)
    if (tierIdx(iso) >= 0) break
    n++
  }
  spinning.value = false
  rerolls.value += n
  lastRerolls.value = n
  counts[iso] = (counts[iso] ?? 0) + 1
  total.value++
  last.value = iso
  lastBall.value = b
}
function reset() {
  for (const k of Object.keys(counts)) delete counts[k]
  total.value = 0
  rerolls.value = 0
  lastRerolls.value = 0
  last.value = null
  lastBall.value = null
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
/* 手機寬度：手機上滿版，電腦上置中一支「手機」 */
.phone { position: relative; width: 100%; max-width: 430px; min-height: 100dvh; margin: 0 auto; background: var(--bg); }
@media (min-width: 600px) {
  .phone { min-height: 0; height: min(932px, calc(100dvh - 48px)); margin: 24px auto; overflow-y: auto; border-radius: 28px;
    box-shadow: 0 0 0 10px #0b0b0b, 0 0 0 11px #333, 0 30px 80px rgba(0, 0, 0, 0.6); scrollbar-width: none; }
  .phone::-webkit-scrollbar { display: none; }
}
.loading { aspect-ratio: 4 / 5; display: grid; place-items: center; color: var(--muted); background: linear-gradient(180deg, #2b0a5e, #ff2e88 60%, #ffd23f); }

/* 操作列 */
.bar { display: flex; gap: 8px; align-items: center; padding: 10px 12px; }
.btn { height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--card); color: var(--text); font: inherit; font-weight: 700; cursor: pointer; }
.btn.main { flex: 1; border: 0; background: linear-gradient(180deg, #ff4d5e, #c4102a); color: #fff; font-size: 17px; box-shadow: 0 3px 0 #6a0613; }
.btn:disabled { opacity: 0.45; cursor: default; }
.seg { display: flex; padding: 3px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); }
.seg button { height: 36px; padding: 0 10px; border: 0; border-radius: 9px; background: none; color: var(--muted); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.seg button.on { background: #ffffff; color: #161616; font-weight: 700; }
.seg.small { display: inline-flex; margin-bottom: 6px; }
.seg.small button { height: 30px; }

/* 分頁：黏在上面 */
.tabs { position: sticky; top: 0; z-index: 10; display: flex; padding: 0 8px; background: var(--bg); border-bottom: 1px solid var(--line); }
.tabs button { flex: 1; height: 44px; border: 0; border-bottom: 3px solid transparent; background: none; color: var(--muted); font: inherit; font-size: 15px; cursor: pointer; }
.tabs button.on { color: var(--text); font-weight: 700; border-bottom-color: #ffd23f; }

.content { padding: 12px 16px calc(32px + env(safe-area-inset-bottom)); font-size: 14px; line-height: 1.6; }
h3 { margin: 18px 0 6px; font-size: 15px; }
section > h3:first-child { margin-top: 4px; }
.hint { margin: 10px 0; font-size: 13px; color: var(--muted); }
.hint.big { font-size: 15px; color: var(--text); }

/* 結果卡 */
.ticket { padding: 14px; border: 2px solid; border-radius: 14px; background: var(--card); }
.t-head { display: flex; gap: 12px; align-items: center; }
.t-flag { flex: none; width: 52px; height: 52px; border-radius: 50%; box-shadow: 0 0 0 2px #e0b64a; }
.t-title { font-size: 12px; color: var(--muted); }
.t-name { font-size: 22px; font-weight: 800; line-height: 1.2; }
.t-name small { display: block; font-size: 13px; font-weight: 500; color: var(--muted); }
.t-prize { margin: 10px 0 8px; font-size: 26px; font-weight: 800; line-height: 1.2; }
.t-en { font-size: 14px; font-weight: 700; }
.t-prize small { display: block; font-size: 12px; font-weight: 500; color: var(--muted); }
.t-nums { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; margin: 0; }
.t-nums .wide { grid-column: 1 / -1; }
.t-nums dt { font-size: 12px; color: var(--muted); }
.t-nums dd { margin: 0; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }
.t-nums small { font-size: 11px; color: var(--dim); }

/* 統計 */
.stats { display: grid; grid-template-columns: auto 1fr; gap: 4px 14px; margin: 0; }
.stats dt { color: var(--muted); }
.stats dd { margin: 0; font-variant-numeric: tabular-nums; }
.stats dd small { margin-left: 8px; color: var(--dim); font-size: 12px; }
.list { margin: 0; padding-left: 28px; }
.list li { padding: 3px 6px; border-radius: 6px; }
.list li > span { display: inline-block; width: calc(100% - 92px); }
.list li > b { display: inline-block; width: 92px; text-align: right; font-weight: normal; color: var(--muted); font-variant-numeric: tabular-nums; }
.list li small { margin-left: 6px; font-size: 12px; color: var(--dim); }
.list li.on { background: rgba(255, 255, 255, 0.1); }
.list.all li > span small { display: block; margin-left: 0; }
.sw { display: inline-block; width: 9px; height: 9px; margin: 0 6px; border-radius: 2px; vertical-align: 0; }
td > .sw { margin-left: 0; }

/* 獎項表 */
.tally { width: 100%; border-collapse: collapse; font-size: 13px; }
.tally th { padding: 4px; color: var(--muted); font-weight: normal; text-align: left; font-size: 12px; }
.tally td { padding: 5px 4px; border-bottom: 1px solid var(--line); font-variant-numeric: tabular-nums; white-space: nowrap; }
.tally .r { text-align: right; }
.tally .dim { color: var(--dim); }
.tally .sum td { font-weight: 700; border-bottom: 0; }

/* 說明 */
.formula { margin: 0 0 8px; padding: 10px 12px; border-radius: 10px; background: var(--card); font-size: 13px; }
.how { margin: 0; padding-left: 20px; }
.how li { margin-bottom: 8px; }
.src { margin: 0; padding-left: 20px; font-size: 13px; }
.src li { margin-bottom: 8px; }
.src a { color: #8fd3ff; word-break: break-all; }

/* ── 舞台上的結果看板（Day 25 原樣，1080×1350 的單位） ── */
.rb-wrap { position: relative; animation: rb-pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1); }
@keyframes rb-pop { 0% { transform: scale(0.2) rotate(-6deg); } 60% { transform: scale(1.08) rotate(1deg); } 100% { transform: scale(1) rotate(0); } }
.rb-burst { position: absolute; left: 50%; top: 50%; width: 900px; height: 900px; margin: -450px 0 0 -450px; border-radius: 50%; pointer-events: none;
  background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--tier) 70%, #fff3b0) 0deg 9deg, rgba(255, 230, 140, 0) 9deg 18deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 62%); mask: radial-gradient(circle, #000 18%, transparent 62%);
  opacity: 0.75; animation: rb-spin 14s linear infinite; }
.rb-star { position: absolute; font-style: normal; color: #fff6cf; text-shadow: 0 0 10px #ffd23f, 0 0 20px var(--tier); pointer-events: none; animation: rb-twinkle 1.2s ease-in-out infinite; }
.rb-star.s1 { left: -40px; top: -30px; font-size: 40px; }
.rb-star.s2 { right: -30px; top: -46px; font-size: 52px; animation-delay: 0.3s; }
.rb-star.s3 { left: 20%; top: -64px; font-size: 26px; animation-delay: 0.6s; }
.rb-star.s4 { right: 24%; top: -58px; font-size: 30px; animation-delay: 0.9s; }
.rb-star.s5 { left: -56px; bottom: 6px; font-size: 30px; animation-delay: 0.45s; }
.rb-star.s6 { right: -54px; bottom: 16px; font-size: 36px; animation-delay: 0.15s; }
.rb-star.s7 { left: 36%; bottom: -54px; font-size: 24px; animation-delay: 0.75s; }
.rb-star.s8 { right: 8%; bottom: -46px; font-size: 28px; animation-delay: 1.05s; }
@keyframes rb-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.6) rotate(0); } 50% { opacity: 1; transform: scale(1.15) rotate(20deg); } }
.rb-shine { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; pointer-events: none; }
.rb-shine::after { content: ''; position: absolute; top: -20%; bottom: -20%; width: 70px; left: -120px; transform: skewX(-20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent); animation: rb-sweep 2.4s ease-in-out infinite; }
@keyframes rb-sweep { 0% { left: -120px; } 60%, 100% { left: 110%; } }
.result-board { position: relative; min-width: 520px; padding: 14px 22px 16px;
  border-radius: 18px; background: linear-gradient(160deg, #ff2e88 0%, #7a1fa2 100%); color: #ffffff;
  border: 4px solid #ffd23f; box-shadow: 6px 6px 0 #2b0a5e, 0 0 0 3px #ff8a00, 0 14px 40px rgba(122, 11, 20, 0.45), inset 0 0 30px rgba(0, 0, 0, 0.35); }
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
.rb-flag { position: relative; width: 92px; height: 92px; border-radius: 50%; overflow: hidden; }
.rb-flag::after { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.75) 0, rgba(255, 255, 255, 0) 32%), radial-gradient(circle at 50% 50%, transparent 58%, rgba(0, 0, 0, 0.35) 100%); }
.rb-main { flex: 1; min-width: 0; }
.rb-name { font-family: 'Overpass', sans-serif; font-size: 44px; font-weight: 900; line-height: 1.05; transform: skewX(-10deg); color: #ffffff;
  -webkit-text-stroke: 6px #2b0a5e; paint-order: stroke fill; text-shadow: 4px 4px 0 #2b0a5e; }
.rb-medal { position: relative; flex: none; width: 104px; height: 104px; transform-origin: 50% -20px; animation: md-swing 2.6s ease-in-out infinite; }
@keyframes md-swing { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
.md-tail { position: absolute; top: 66px; width: 32px; height: 76px;
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
.md-face em { font-style: normal; font-size: 11px; letter-spacing: 0.05em; color: #fff3b0; }
.md-face b { margin: 2px 0 1px; font-size: 26px; font-weight: 900; letter-spacing: 0.02em; }
.md-face.long b { font-size: 18px; }
.md-face small { font-size: 10px; font-weight: 800; letter-spacing: 0.2em; }
@keyframes rb-spin { to { transform: rotate(360deg); } }
.board-enter-active { transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.2, 1.4, 0.4, 1); }
.board-leave-active { transition: opacity 0.15s ease; }
.board-enter-from { opacity: 0; transform: translateY(30px) scale(0.8); }
.board-leave-to { opacity: 0; }
</style>
