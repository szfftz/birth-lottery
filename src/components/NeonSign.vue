<!-- BIRTH LOTTERY 霓虹招牌（每個模式共用同一塊）：黑底板、粉紅＋青色兩圈霓虹燈管框、一排會閃的星星、
     BIRTH 粉紅／LOTTERY 青色霓虹字（輪流閃，E 偶爾接觸不良）、子標也在看板裡（紫色燈管框，三段輪流亮）。
     用寬 1080 的設計稿尺寸，外面自己縮放 -->
<template>
  <div class="neon-sign">
    <div class="st-sign">
      <i class="st-tube"></i>
      <span class="st-by">SZFFTZ</span>
      <div class="st-stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></div>
      <div v-if="lang === 'zh'" class="st-main zh"><span class="n-pink">出生</span><span class="n-cyan">搖搖<b>樂</b></span></div>
      <div v-else-if="lang === 'ja'" class="st-main zh"><span class="n-pink">国</span><span class="n-cyan">ガチ<b>ャ</b></span></div>
      <div v-else-if="lang === 'ko'" class="st-main zh ko"><span class="n-pink">출생</span> <span class="n-cyan">로<b>또</b></span></div>
      <div v-else class="st-main"><span class="n-pink">BIRTH</span> <span class="n-cyan">LOTT<b>E</b>RY</span></div>
      <div v-if="lang === 'zh'" class="st-sub"><span>{{ balls.toLocaleString('en-US') }} 顆球</span><i>◆</i><span>{{ countries }} 國</span><i>◆</i><span>1 球 ≈ {{ fmtBig(POP_UNIT) }}人</span></div>
      <div v-else-if="lang === 'ja'" class="st-sub"><span>ボール {{ balls.toLocaleString('en-US') }} 個</span><i>◆</i><span>{{ countries }} か国</span><i>◆</i><span>1 個 ≈ {{ fmtBig(POP_UNIT) }}人</span></div>
      <div v-else-if="lang === 'ko'" class="st-sub"><span>공 {{ balls.toLocaleString('en-US') }}개</span><i>◆</i><span>{{ countries }}개국</span><i>◆</i><span>1개 ≈ {{ fmtBig(POP_UNIT) }} 명</span></div>
      <div v-else class="st-sub"><span>{{ balls.toLocaleString('en-US') }} BALLS</span><i>◆</i><span>{{ countries }} COUNTRIES</span><i>◆</i><span>1 BALL ≈ {{ POP_UNIT / 1e6 }}M</span></div>
    </div>
  </div>
</template>

<script setup>
import { lang } from '../i18n.js'
import { fmtBig, POP_UNIT } from '../lottery.js' // 1 顆球大約代表幾個人
defineProps({ balls: { type: Number, default: 0 }, countries: { type: Number, default: 0 } })
</script>

<style scoped>
.neon-sign { width: 880px; text-align: center; font-family: 'Overpass', 'Huninn', 'NanumSquareRoundB', 'Noto Sans TC', sans-serif; }
.st-sign { position: relative; padding: 34px 40px 50px; border-radius: 40px; border: 7px solid #ffd6ec;
  background: radial-gradient(120% 120% at 50% 40%, rgba(255, 45, 149, 0.16), transparent 60%), linear-gradient(180deg, #120a24, #07040f);
  box-shadow: 0 0 4px #ff2d95, 0 0 16px #ff2d95, 0 0 42px #ff2d95, 0 0 90px rgba(255, 45, 149, 0.55),
    inset 0 0 6px #ff2d95, inset 0 0 26px rgba(255, 45, 149, 0.7), 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: n-hum 1.6s ease-in-out infinite; }
/* 背景橫條燈：一條條粉紫色的橫燈管（中間最亮、往上下淡掉），再加一道亮帶由下往上掃過 */
.st-sign::before { content: ''; position: absolute; inset: 18px; border-radius: 24px; pointer-events: none;
  background:
    linear-gradient(180deg, transparent 0%, rgba(255, 220, 245, 0.55) 46%, rgba(255, 220, 245, 0.55) 54%, transparent 100%) 0 0 / 100% 300% no-repeat,
    repeating-linear-gradient(180deg, transparent 0 13px, rgba(255, 70, 170, 0.42) 13px 15px, rgba(255, 200, 240, 0.65) 15px 17px, rgba(255, 70, 170, 0.42) 17px 19px, transparent 19px 26px);
  -webkit-mask: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent), linear-gradient(180deg, rgba(0,0,0,.5), #000 40%, #000 60%, rgba(0,0,0,.5));
  -webkit-mask-composite: source-in; mask-composite: intersect;
  mix-blend-mode: screen; animation: n-bars 3.2s linear infinite, n-bars-hum 2.4s ease-in-out infinite; }
@keyframes n-bars { from { background-position: 0 120%, 0 0; } to { background-position: 0 -20%, 0 0; } }
@keyframes n-bars-hum { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
.st-tube { position: absolute; inset: 14px; border-radius: 28px; border: 4px solid #d8fdff; pointer-events: none;
  box-shadow: 0 0 4px #19e6ff, 0 0 14px #19e6ff, 0 0 30px rgba(25, 230, 255, 0.7), inset 0 0 4px #19e6ff, inset 0 0 16px rgba(25, 230, 255, 0.6); }
/* 一排霓虹黃星星，輪流閃 */
.st-stars { position: relative; display: flex; justify-content: center; gap: 26px; margin-bottom: 2px; }
.st-stars i { font-style: normal; font-size: 40px; line-height: 1; color: #fff6c4; text-shadow: 0 0 3px #fff, 0 0 10px #ffc21a, 0 0 22px #ffb000, 0 0 44px #ff9500;
  animation: n-blink 1.5s steps(1) infinite; }
.st-stars i:nth-child(2n) { animation-delay: 0.75s; }
.st-stars i:nth-child(3) { font-size: 52px; }
.st-main { position: relative; margin-top: 0; font-family: 'Tilt Neon', 'Overpass', sans-serif; font-size: 108px; line-height: 1.05; letter-spacing: -0.005em; white-space: nowrap; }
.st-main span { display: inline-block; }
.st-main.zh { font-family: 'Huninn', 'Noto Sans TC', sans-serif; font-weight: 500; font-size: 112px; letter-spacing: -0.005em; }
.st-main.ko { font-family: 'NanumSquareRoundEB', 'Huninn', sans-serif; font-weight: 400; letter-spacing: -0.005em; }
.n-pink { color: #ffe3f1; text-shadow: 0 0 2px #fff, 0 0 8px #ff4fae, 0 0 18px #ff2d95, 0 0 40px #ff2d95, 0 0 80px #ff2d95; }
.n-cyan { color: #e2feff; text-shadow: 0 0 2px #fff, 0 0 8px #3defff, 0 0 18px #19e6ff, 0 0 40px #19e6ff, 0 0 80px #19e6ff; }
.n-cyan b { font-weight: inherit; animation: n-flicker 5s linear infinite; } /* 一個字母像接觸不良，偶爾閃掉 */
/* 霓虹閃：BIRTH、LOTTERY 輪流閃兩下（像霓虹招牌的跳燈），外框燈管一明一暗 */
.n-pink { animation: n-flash 2.6s linear infinite; }
.n-cyan { animation: n-flash 2.6s linear infinite -1.3s; }
.st-tube { animation: n-tube 1.3s steps(1) infinite; }
@keyframes n-flash { 0%, 30%, 38%, 100% { opacity: 1; filter: brightness(1.15); } 31%, 34% { opacity: 0.22; filter: brightness(0.6); } 32.5%, 36% { opacity: 1; filter: brightness(1.4); } }
/* 子標也閃：外框紫色燈管一明一暗、三段字輪流亮起來 */
.st-sub { animation: n-sub 1s steps(1) infinite; }
.st-sub span { animation: n-word 1.8s steps(1) infinite; }
.st-sub span:nth-of-type(2) { animation-delay: 0.6s; }
.st-sub span:nth-of-type(3) { animation-delay: 1.2s; }
.st-sub i { animation: n-blink 0.9s steps(1) infinite; }
@keyframes n-sub { 50% { box-shadow: 0 0 3px #b14dff, inset 0 0 3px rgba(177, 77, 255, 0.5); border-color: #b98ad8; } }
@keyframes n-word { 0% { color: #fff; text-shadow: 0 0 4px #fff, 0 0 14px #e3a6ff, 0 0 28px #b14dff; } 33.4%, 100% { color: #f3e6ff; text-shadow: 0 0 6px rgba(214, 160, 255, 0.7); } }
@keyframes n-tube { 50% { opacity: 0.35; } }
@keyframes n-hum { 0%, 100% { filter: brightness(0.9); } 50% { filter: brightness(1.25); } }
@keyframes n-blink { 50% { opacity: 0.25; } }
@keyframes n-flicker { 0%, 88%, 90%, 93%, 100% { opacity: 1; } 89%, 91.5%, 92.5% { opacity: 0.18; text-shadow: none; } }
.st-sub { display: inline-flex; align-items: center; gap: 16px; margin-top: 22px; padding: 8px 28px; border-radius: 999px;
  background: rgba(8, 4, 18, 0.7); border: 3px solid #f1dcff; color: #ffffff;
  box-shadow: 0 0 6px #b14dff, 0 0 18px #9b30ff, inset 0 0 8px rgba(177, 77, 255, 0.7);
  font-size: 27px; /* 三段字（幾顆球、幾國、1 球幾人）一行寫完 */ font-weight: 800; letter-spacing: -0.005em; white-space: nowrap; text-shadow: 0 0 8px rgba(214, 160, 255, 0.9); }
.st-sub i { font-style: normal; font-size: 18px; color: #ff6fc1; text-shadow: 0 0 8px #ff2d95; }
/* 正下方的署名（子標下面、置中）：細細的青色霓虹，不搶戲；字距 -5 */
.st-by { position: absolute; left: 0; right: 0; bottom: 23px; text-align: center; font-family: 'Overpass', sans-serif; font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -0.005em;
  color: #d8fdff; opacity: 0.8; text-shadow: 0 0 4px #19e6ff, 0 0 10px rgba(25, 230, 255, 0.7); pointer-events: none; }
/* 手機：整塊招牌的亮度動畫（filter）、橫條燈的 screen 混色都很吃效能 → 招牌不跟著呼吸、字只用透明度閃、橫條燈一般疊上去 */
@media (pointer: coarse) {
  .st-sign { animation: none; }
  .st-sign::before { mix-blend-mode: normal; opacity: 0.8; animation: none; background-position: 0 50%, 0 0; } /* 橫條燈不掃：背景位置動畫每一格都要重畫整塊招牌 */
  .n-pink, .n-cyan { animation-name: n-flash-lite; }
}
@keyframes n-flash-lite { 0%, 30%, 38%, 100% { opacity: 1; } 31%, 34% { opacity: 0.22; } }
@media (prefers-reduced-motion: reduce) { .st-sign::before, .st-tube, .st-sub, .st-sub span, .st-sub i, .n-pink, .n-cyan, .n-cyan b, .st-stars i { animation: none; } }
</style>
