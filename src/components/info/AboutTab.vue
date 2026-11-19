<template>
  <!-- 說明分頁：計算方法（三步驟）、更多說明、網址、資料來源；四種語言各寫一份 -->
  <section>
    <h3>{{ L('How it works', '計算方法', 'しくみ', '계산 방법') }}</h3>
    <!-- 三個步驟，寫給國高中生看得懂 -->
    <ol v-if="lang === 'zh'" class="steps">
      <li><b>把全世界的人換成彩球</b>每 {{ fmtBig(POP_UNIT) }} 個人做成 1 顆球；人很少的國家也至少給 1 顆，所以總共 {{ BALL_TOTAL }} 顆。例如印度人最多，有 {{ BALLS.IND }} 顆；臺灣有 {{ BALLS.TWN }} 顆。</li>
      <li><b>隨便抽一顆球</b>抽到某一國的機率＝那一國的球數 ÷ 全部的球數。例如臺灣：{{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}，大約每 {{ oneIn(pIso('TWN')) }} 次才會抽到一次。</li>
      <li v-if="SHOW_PRIZE"><b>看那一國的人類發展指數，決定中幾獎</b>人類發展指數（HDI）是 0 到 1 的分數，把平均壽命、受教育的年數、收入加在一起算，越接近 1 代表生活條件越好。人類發展指數越高獎越大，但這種國家人口少，所以越難抽到。</li>
      <li v-else><b>看那一國的人類發展指數</b>人類發展指數（HDI）是 0 到 1 的分數，把平均壽命、受教育的年數、收入加在一起算，越接近 1 代表生活條件越好。但人類發展指數高的國家人口少，所以越難抽到。</li>
    </ol>
    <ol v-else-if="lang === 'ja'" class="steps">
      <li><b>世界中の人をボールにする</b>{{ fmtBig(POP_UNIT) }} 人ごとにボールを 1 個作ります。人口がとても少ない国にも最低 1 個あげるので、全部で {{ BALL_TOTAL }} 個。いちばん人口が多いインドは {{ BALLS.IND }} 個、台湾は {{ BALLS.TWN }} 個です。</li>
      <li><b>ボールを 1 個引く</b>ある国が当たる確率＝その国のボール数 ÷ 全部のボール数。たとえば台湾は {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}、だいたい {{ oneIn(pIso('TWN')) }} 回に 1 回です。</li>
      <li v-if="SHOW_PRIZE"><b>その国の HDI で賞が決まる</b>HDI（人間開発指数）は 0〜1 の点数で、平均寿命・教育を受けた年数・収入をまとめて計算します。1 に近いほど暮らしやすい国。HDI が高いほど大きな賞ですが、そういう国は人口が少ないので当たりにくいのです。</li>
      <li v-else><b>その国の HDI を見る</b>HDI（人間開発指数）は 0〜1 の点数で、平均寿命・教育を受けた年数・収入をまとめて計算します。1 に近いほど暮らしやすい国。でも HDI が高い国は人口が少ないので当たりにくいのです。</li>
    </ol>
    <ol v-else-if="lang === 'ko'" class="steps">
      <li><b>세계 사람들을 공으로 바꾸기</b>{{ fmtBig(POP_UNIT) }}명마다 공 1개를 만들어요. 인구가 아주 적은 나라도 최소 1개를 주니까 모두 {{ BALL_TOTAL }}개예요. 인구가 가장 많은 인도는 {{ BALLS.IND }}개, 대만은 {{ BALLS.TWN }}개예요.</li>
      <li><b>공 하나 뽑기</b>어떤 나라가 뽑힐 확률 = 그 나라의 공 수 ÷ 전체 공 수. 예를 들어 대만은 {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}, 대략 {{ oneIn(pIso('TWN')) }}번에 한 번이에요.</li>
      <li v-if="SHOW_PRIZE"><b>그 나라의 HDI로 상이 정해져요</b>HDI(인간개발지수)는 0에서 1 사이의 점수로, 평균 수명·교육 기간·소득을 합쳐서 계산해요. 1에 가까울수록 살기 좋은 나라예요. HDI가 높을수록 큰 상이지만, 그런 나라는 인구가 적어서 뽑기 어려워요.</li>
      <li v-else><b>그 나라의 HDI를 봐요</b>HDI(인간개발지수)는 0에서 1 사이의 점수로, 평균 수명·교육 기간·소득을 합쳐서 계산해요. 1에 가까울수록 살기 좋은 나라예요. 하지만 HDI가 높은 나라는 인구가 적어서 뽑기 어려워요.</li>
    </ol>
    <ol v-else class="steps">
      <li><b>Turn people into balls</b>We make 1 ball for every {{ fmtBig(POP_UNIT) }} people. Even the smallest country gets 1 ball. That makes {{ BALL_TOTAL }} balls in total. India has the most people, so it gets {{ BALLS.IND }} balls. Taiwan gets {{ BALLS.TWN }}.</li>
      <li><b>Pick one ball</b>Your chance of getting a country is its number of balls divided by all the balls. For Taiwan, that's {{ BALLS.TWN }} ÷ {{ BALL_TOTAL }} ≈ {{ fmtP(pIso('TWN')) }}. That's about 1 in {{ oneIn(pIso('TWN')) }}.</li>
      <li v-if="SHOW_PRIZE"><b>The country's HDI is your prize</b>HDI is a score from 0 to 1. It shows how long people live, how many years they go to school, and how much money they make. A higher score means a better life and a bigger prize. But high-score countries have fewer people, so they are harder to get.</li>
      <li v-else><b>Look at the country's HDI</b>HDI is a score from 0 to 1. It shows how long people live, how many years they go to school, and how much money they make. A higher score means a better life. But high-score countries have fewer people, so they are harder to get.</li>
    </ol>
    <h3>{{ L('More details', '更多說明', 'くわしい説明', '자세한 설명') }}</h3>
    <ol v-if="lang === 'en'" class="how">
      <li><b>Idea</b>You can't choose where you're born — it's a lottery. Treat every person on Earth as one ticket: countries with more people hold more tickets, so India and China are the most likely draws. Your "prize" is that country's Human Development Index — life expectancy, education and income combined.</li>
      <li><b>Population</b>English Wikipedia, "<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>", sovereign states only: the 193 UN members, the two observer states (Vatican City and Palestine), plus Taiwan — {{ meta.count }} countries in all.</li>
      <li><b>HDI</b>English Wikipedia, "<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>", using UNDP's {{ meta.hdi.year }} HDI from the 2025 Human Development Report. Taiwan isn't in the UNDP data, so its {{ C.TWN.hdi }} (2023) comes from the <a :href="SOURCES[2].url" target="_blank" rel="noopener">English Wikipedia Taiwan</a> infobox. North Korea uses {{ C.PRK.hdi }} ({{ meta.prk.year }}) from the <a :href="SOURCES[3].url" target="_blank" rel="noopener">Chinese Wikipedia</a> infobox. Monaco and Vatican City have no HDI, so drawing them means a redraw.</li>
      <li v-if="SHOW_PRIZE"><b>Prizes</b>Countries are ranked by HDI and cut into {{ TIERS.length }} tiers. Each tier is more likely than the one above, as close as possible to 1:2:4:8:16:32:64:128. Countries with the same HDI aren't split, so the ratios are close but not exact.</li>
      <li><b>Balls</b>{{ BALL_TOTAL }} balls in all, at least one per country ({{ ONE_BALL }} countries have just one). Otherwise one ball ≈ {{ fmtBig(POP_UNIT) }} people; India has the most ({{ BALLS.IND }}). Tiny countries still get one ball, so their odds are a bit higher than their population share.</li>
      <li v-if="SHOW_PRIZE"><b>Map</b>Countries are coloured by prize. Turn on “Draws” to circle every country you've drawn; a circle's area is that country's share of all your draws, which gets closer to its population share the more you draw. Borders from <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:50m.</li>
      <li v-else><b>Map</b>Countries are coloured by HDI: the higher the HDI, the warmer the colour. Turn on “Draws” to circle every country you've drawn; a circle's area is that country's share of all your draws, which gets closer to its population share the more you draw. Borders from <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:50m.</li>
      <li v-if="SHOW_PRIZE"><b>Box modes</b>The balls packed into a 3D clear acrylic case with the lid open. World Box groups countries by where they are in the world; Prize Box lines the balls up by prize — Grand Prize first — with dividers and a different pastel for each prize.</li>
      <li v-else><b>Box modes</b>The balls packed into a 3D clear acrylic case with the lid open. World Box groups countries by where they are in the world.</li>
      <li><b>Lottery drum (Game)</b>All {{ BALL_TOTAL }} balls go into a 3D clear drum, and the draw is decided entirely by the physics simulation. The drum spins (each spin's length is multiplied by a random 0.85–1.15), three paddles carry the balls up and tumble them; then the outlet turns to the bottom and the gate opens, and the first ball to fall through is the winner, rolling down the chute into the tray. If it's a redraw ball, the drum spins again.</li>
    </ol>
    <ol v-else-if="lang === 'ja'" class="how">
      <li><b>アイデア</b>どこに生まれるかは自分で選べない——まるで宝くじ。地球上の一人ひとりを 1 枚のくじと考えると、人口の多い国ほどくじが多いので、インドや中国がいちばん当たりやすくなります。当たった「賞品」はその国の人間開発指数（寿命・教育・所得をまとめた暮らしの指標）です。</li>
      <li><b>人口</b>英語版ウィキペディア「<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>」から主権国家のみ：国連加盟 193 か国、オブザーバー国家の 2 か国（バチカン・パレスチナ）、そして台湾、計 {{ meta.count }} か国。</li>
      <li><b>HDI</b>英語版ウィキペディア「<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>」、UNDP『人間開発報告書 2025』の {{ meta.hdi.year }} 年の値。台湾は UNDP のデータにないので、英語版ウィキペディア <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> の情報ボックスの {{ C.TWN.hdi }}（2023 年）。北朝鮮は<a :href="SOURCES[3].url" target="_blank" rel="noopener">中国語版ウィキペディア</a>の {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。モナコとバチカンは HDI がないので、当たったら引き直しです。</li>
      <li v-if="SHOW_PRIZE"><b>賞</b>国を HDI の高い順に並べて {{ TIERS.length }} 段に分け、下の賞ほど当たりやすく、なるべく 1:2:4:8:16:32:64:128 に近づけています。同じ HDI の国は分けないので、ぴったりにはなりません。</li>
      <li><b>ボール</b>全部で {{ BALL_TOTAL }} 個、どの国も最低 1 個（{{ ONE_BALL }} か国は 1 個だけ）。それ以外はボール 1 個 ≈ {{ fmtBig(POP_UNIT) }} 人で、いちばん多いのはインド（{{ BALLS.IND }} 個）。人口がとても少ない国も 1 個あるので、人口の割合より少し当たりやすくなります。</li>
      <li v-if="SHOW_PRIZE"><b>地図</b>国を賞の色で塗り分けています。「当たった国」をオンにすると当たった国に円を描き、円の面積＝その国の当選回数の割合。たくさん引くほど人口の割合に近づきます。国境は <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> の 1:5,000 万。</li>
      <li v-else><b>地図</b>国を HDI の高さで塗り分けています。「当たった国」をオンにすると当たった国に円を描き、円の面積＝その国の当選回数の割合。たくさん引くほど人口の割合に近づきます。国境は <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> の 1:5,000 万。</li>
      <li v-if="SHOW_PRIZE"><b>ボール箱</b>ボールを 3D の透明アクリルケースに入れ、ふたを開けています。「世界ボール箱」は各国の世界での位置どおりに並べ、「賞別ボール箱」は特賞から残念賞まで賞の順に並べて、賞ごとに仕切りと色を変えています。</li>
      <li v-else><b>ボール箱</b>ボールを 3D の透明アクリルケースに入れ、ふたを開けています。「世界ボール箱」は各国の世界での位置どおりに並べています。</li>
      <li><b>抽選機（ゲーム）</b>{{ BALL_TOTAL }} 個のボールを 3D の透明ドラムに入れ、どれが出るかはすべて物理シミュレーションで決まります。ドラムが回り（毎回の回転時間に 0.85〜1.15 の乱数を掛けます）、中の 3 枚の羽根がボールを持ち上げてかき混ぜます。止まると出口が真下に来てゲートが開き、最初に重力で穴を通ったボールが当たり。シュートを転がって前のトレーに入ります。引き直しボールならもう一度回します。</li>
    </ol>
    <ol v-else-if="lang === 'ko'" class="how">
      <li><b>아이디어</b>어디서 태어날지는 스스로 고를 수 없어요 — 마치 복권처럼요. 지구의 모든 사람을 복권 한 장으로 생각하면, 인구가 많은 나라일수록 복권이 많아서 인도와 중국이 가장 잘 뽑혀요. 받는 「상품」은 그 나라의 인간개발지수(수명·교육·소득을 합친 생활 수준)예요.</li>
      <li><b>인구</b>영어 위키백과 「<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>」에서 주권 국가만: 유엔 회원국 193개국, 옵서버 국가 2개국(바티칸·팔레스타인), 그리고 대만, 모두 {{ meta.count }}개국.</li>
      <li><b>HDI</b>영어 위키백과 「<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>」, UNDP 「인간개발보고서 2025」의 {{ meta.hdi.year }}년 수치. 대만은 UNDP 자료에 없어서 영어 위키백과 <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> 정보 상자의 {{ C.TWN.hdi }}(2023년)을 써요. 북한은 <a :href="SOURCES[3].url" target="_blank" rel="noopener">중국어 위키백과</a>의 {{ C.PRK.hdi }}({{ meta.prk.year }}년). 모나코와 바티칸은 HDI가 없어서 뽑히면 다시 뽑아요.</li>
      <li v-if="SHOW_PRIZE"><b>상</b>나라를 HDI 높은 순으로 줄 세워 {{ TIERS.length }}단계로 나눴어요. 아래 상일수록 뽑힐 확률이 커서 1:2:4:8:16:32:64:128에 최대한 가깝게 맞췄어요. 같은 HDI는 나누지 않아서 딱 맞지는 않아요.</li>
      <li><b>공</b>모두 {{ BALL_TOTAL }}개, 모든 나라가 최소 1개({{ ONE_BALL }}개국은 1개뿐). 나머지는 공 1개 ≈ {{ fmtBig(POP_UNIT) }}명이고, 가장 많은 나라는 인도({{ BALLS.IND }}개). 인구가 아주 적은 나라도 1개가 있어서 인구 비율보다 조금 더 잘 뽑혀요.</li>
      <li v-if="SHOW_PRIZE"><b>지도</b>나라를 상 색깔로 칠했어요. 「뽑힌 나라」를 켜면 뽑힌 나라에 원을 그리고, 원의 면적 = 그 나라가 뽑힌 횟수의 비율. 많이 뽑을수록 인구 비율에 가까워져요. 국경은 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000만.</li>
      <li v-else><b>지도</b>나라를 HDI 높낮이에 따라 색칠했어요. 「뽑힌 나라」를 켜면 뽑힌 나라에 원을 그리고, 원의 면적 = 그 나라가 뽑힌 횟수의 비율. 많이 뽑을수록 인구 비율에 가까워져요. 국경은 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000만.</li>
      <li v-if="SHOW_PRIZE"><b>공 상자</b>공을 3D 투명 아크릴 상자에 담고 뚜껑을 열어 두었어요. 「세계 공 상자」는 나라들의 세계 속 위치대로, 「상별 공 상자」는 특등부터 꽝까지 상 순서로 늘어놓고 상마다 칸막이와 색을 달리했어요.</li>
      <li v-else><b>공 상자</b>공을 3D 투명 아크릴 상자에 담고 뚜껑을 열어 두었어요. 「세계 공 상자」는 나라들의 세계 속 위치대로 늘어놓았어요.</li>
      <li><b>추첨기 (게임)</b>공 {{ BALL_TOTAL }}개를 3D 투명 드럼에 넣고, 어느 공이 나올지는 전부 물리 시뮬레이션으로 정해져요. 드럼이 돌고(돌리는 시간에 매번 0.85~1.15의 난수를 곱해요), 안의 날개 3개가 공을 들어 올려 섞어요. 멈추면 출구가 바로 아래로 오고 문이 열려, 중력으로 가장 먼저 구멍을 통과한 공이 당첨! 미끄럼틀을 굴러 앞의 쟁반에 들어가요. 다시 뽑기 공이면 한 번 더 돌려요.</li>
    </ol>
    <ol v-else class="how">
      <li><b>想法</b>出生在哪裡自己選不了，就像抽樂透。全世界每個人當成一張彩券，人越多的國家彩券越多，所以抽到印度、中國的機會最大；抽到後拿到的「獎品」是那個國家的人類發展指數——壽命、教育、所得綜合起來的生活條件。</li>
      <li><b>人口</b>英文維基百科〈<a :href="SOURCES[1].url" target="_blank" rel="noopener">List of countries and dependencies by population</a>〉，只看正式國家：聯合國 193 個會員國、梵蒂岡和巴勒斯坦兩個觀察員國，加上臺灣，共 {{ meta.count }} 國。</li>
      <li><b>人類發展指數</b>英文維基百科〈<a :href="SOURCES[0].url" target="_blank" rel="noopener">List of countries by Human Development Index</a>〉，數字是聯合國開發計畫署（UNDP）《2025 人類發展報告》的 {{ meta.hdi.year }} 年人類發展指數。臺灣不在聯合國的資料裡，用英文維基 <a :href="SOURCES[2].url" target="_blank" rel="noopener">Taiwan</a> 條目資訊框的 {{ C.TWN.hdi }}（2023 年）。北韓用<a :href="SOURCES[3].url" target="_blank" rel="noopener">中文維基</a>資訊框的 {{ C.PRK.hdi }}（{{ meta.prk.year }} 年）。摩納哥、梵蒂岡沒有人類發展指數，抽到算「重抽」。</li>
      <li v-if="SHOW_PRIZE"><b>獎項</b>把國家照人類發展指數由高到低排，切成 {{ TIERS.length }} 段，每一級的中獎機率都比上一級大，盡量接近 1:2:4:8:16:32:64:128；同一個人類發展指數不拆開，所以只能接近，不會剛好。</li>
      <li><b>彩球</b>總共 {{ BALL_TOTAL }} 顆，每國至少 1 顆（{{ ONE_BALL }} 國只有 1 顆）；其他國家 1 顆＝平均 {{ fmtBig(POP_UNIT) }} 人，印度最多（{{ BALLS.IND }} 顆）。人口很少的國家也有 1 顆，抽中的機會比人口比例高。</li>
      <li v-if="SHOW_PRIZE"><b>地圖模式</b>國家照獎項填色；打開「抽過的」會在抽過的國家畫投胎紀錄圓，圓面積＝這一國抽中的次數佔全部的幾成，抽得越多越接近各國人口比例。地圖用 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000 萬國界。</li>
      <li v-else><b>地圖模式</b>國家照人類發展指數的高低填色；打開「抽過的」會在抽過的國家畫投胎紀錄圓，圓面積＝這一國抽中的次數佔全部的幾成，抽得越多越接近各國人口比例。地圖用 <a :href="SOURCES[5].url" target="_blank" rel="noopener">Natural Earth</a> 1:5,000 萬國界。</li>
      <li v-if="SHOW_PRIZE"><b>彩球盒</b>把球裝進 3D 的透明壓克力收納盒、蓋子打開；「世界彩球盒」照各國在世界上的相對位置放，同一洲的國家在一起；「獎項彩球盒」照獎項從特獎排到哈哈獎，每一獎用隔板隔開、鋪不同的淡色。</li>
      <li v-else><b>彩球盒</b>把球裝進 3D 的透明壓克力收納盒、蓋子打開；「世界彩球盒」照各國在世界上的相對位置放，同一洲的國家在一起。</li>
      <li><b>搖獎機（遊戲模式）</b>{{ BALL_TOTAL }} 顆球放進 3D 的透明滾筒，抽到哪一顆全部照物理模擬決定。滾筒轉起來（每次轉的時間乘 0.85～1.15 的亂數），筒裡三片擋板把球帶上去再翻下來；停下來後出球口轉到正下方、打開閘門，哪一顆球靠重力先穿過洞口就是抽到的，沿著滑道滾進前面的盤子。掉出來的是重抽球就再搖一次。</li>
    </ol>

    <h3>{{ L('Website', '網址', 'URL', '주소') }}</h3>
    <p class="card"><a class="url" :href="SITE" target="_blank" rel="noopener">{{ SITE }}</a></p>

    <h3>{{ L('Data sources', '資料來源', 'データ出典', '자료 출처') }}</h3>
    <ul class="src">
      <li v-for="s in SOURCES" :key="s.url"><b>{{ L(...s.label) }}</b>{{ L(...s.org) }}<a :href="s.url" target="_blank" rel="noopener">{{ s.url }}</a></li>
    </ul>
  </section>
</template>

<script setup>
import { L, lang } from '../../i18n.js'
import { meta, C, BALLS, BALL_TOTAL, POP_UNIT, ONE_BALL, TIERS, pIso, fmtP, oneIn, fmtBig, SHOW_PRIZE } from '../../lottery.js'

const SOURCES = [
  { label: ['Human Development Index (UNDP Human Development Report 2025, 2023 data)', '人類發展指數 HDI（聯合國開發計畫署 UNDP《2025 人類發展報告》，2023 年）', '人間開発指数 HDI（UNDP『人間開発報告書 2025』、2023 年）', '인간개발지수 HDI (UNDP 「인간개발보고서 2025」, 2023년)'], org: ['English Wikipedia: List of countries by Human Development Index', '英文維基百科 List of countries by Human Development Index', '英語版ウィキペディア List of countries by Human Development Index', '영어 위키백과 List of countries by Human Development Index'], url: 'https://en.wikipedia.org/wiki/List_of_countries_by_Human_Development_Index' },
  { label: ['Population', '各國人口', '各国の人口', '나라별 인구'], org: ['English Wikipedia: List of countries and dependencies by population', '英文維基百科 List of countries and dependencies by population', '英語版ウィキペディア List of countries and dependencies by population', '영어 위키백과 List of countries and dependencies by population'], url: 'https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population' },
  { label: ['Taiwan HDI (not covered by UNDP)', '臺灣的人類發展指數（聯合國的資料不含臺灣）', '台湾の HDI（UNDP に含まれない）', '대만 HDI (UNDP 미포함)'], org: ['English Wikipedia: Taiwan article infobox', '英文維基百科 Taiwan 條目資訊框', '英語版ウィキペディア Taiwan 記事の情報ボックス', '영어 위키백과 Taiwan 문서 정보 상자'], url: 'https://en.wikipedia.org/wiki/Taiwan' },
  { label: ['North Korea HDI (not covered by UNDP, 2016)', '北韓的人類發展指數（聯合國沒算，2016 年）', '北朝鮮の HDI（UNDP 対象外、2016 年）', '북한 HDI (UNDP 미산출, 2016년)'], org: ['Chinese Wikipedia: North Korea article infobox', '中文維基百科「朝鲜民主主义人民共和国」條目資訊框', '中国語版ウィキペディア「朝鲜民主主义人民共和国」の情報ボックス', '중국어 위키백과 「朝鲜民主主义人民共和国」 문서 정보 상자'], url: 'https://zh.wikipedia.org/wiki/朝鲜民主主义人民共和国' },
  { label: ['Flags (1:1 square SVG, 7.6.0)', '國旗（1:1 正方形 SVG，7.6.0）', '国旗（1:1 正方形 SVG、7.6.0）', '국기 (1:1 정사각형 SVG, 7.6.0)'], org: ['flag-icons (MIT)', 'flag-icons（MIT）', 'flag-icons（MIT）', 'flag-icons (MIT)'], url: 'https://github.com/lipis/flag-icons' },
  { label: ['Borders (1:50m Admin 0 – Countries)', '國界（1:50m Admin 0 – Countries）', '国境（1:50m Admin 0 – Countries）', '국경 (1:50m Admin 0 – Countries)'], org: ['Natural Earth (public domain)', 'Natural Earth（公有領域）', 'Natural Earth（パブリックドメイン）', 'Natural Earth (퍼블릭 도메인)'], url: 'https://www.naturalearthdata.com/' },
]
// 版本號、建置時間（vite.config.js 在建置時填進來）
// 實際網頁
const SITE = 'https://szfftz.github.io/birth-lottery/'
</script>
