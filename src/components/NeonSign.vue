<!-- BIRTH LOTTERY 霓虹招牌（每個模式共用同一塊）：黑底板、粉紅＋青色兩圈霓虹燈管框、一排會閃的星星、
     BIRTH 粉紅／LOTTERY 青色霓虹字（輪流閃，E 偶爾接觸不良）、子標也在看板裡（紫色燈管框，三段輪流亮）。
     用寬 1080 的設計稿尺寸，外面自己縮放 -->
<template>
  <div class="neon-sign">
    <div class="st-sign">
      <i class="st-tube"></i>
      <div class="st-stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></div>
      <div class="st-main"><span class="n-pink">BIRTH</span> <span class="n-cyan">LOTT<b>E</b>RY</span></div>
      <div class="st-sub"><span>{{ balls.toLocaleString('en-US') }} BALLS</span><i>◆</i><span>{{ countries }} COUNTRIES</span><i>◆</i><span>1 LIFE</span></div>
    </div>
  </div>
</template>

<script setup>
defineProps({ balls: { type: Number, default: 0 }, countries: { type: Number, default: 0 } })
</script>

<style scoped>
.neon-sign { width: 880px; text-align: center; font-family: 'Overpass', 'Noto Sans TC', sans-serif; }
.st-sign { position: relative; padding: 34px 40px 36px; border-radius: 40px; border: 7px solid #ffd6ec;
  background: radial-gradient(120% 120% at 50% 40%, rgba(255, 45, 149, 0.16), transparent 60%), linear-gradient(180deg, #120a24, #07040f);
  box-shadow: 0 0 4px #ff2d95, 0 0 16px #ff2d95, 0 0 42px #ff2d95, 0 0 90px rgba(255, 45, 149, 0.55),
    inset 0 0 6px #ff2d95, inset 0 0 26px rgba(255, 45, 149, 0.7), 0 20px 40px rgba(0, 0, 0, 0.6);
  animation: n-hum 1.6s ease-in-out infinite; }
.st-tube { position: absolute; inset: 14px; border-radius: 28px; border: 4px solid #d8fdff; pointer-events: none;
  box-shadow: 0 0 4px #19e6ff, 0 0 14px #19e6ff, 0 0 30px rgba(25, 230, 255, 0.7), inset 0 0 4px #19e6ff, inset 0 0 16px rgba(25, 230, 255, 0.6); }
/* 一排霓虹黃星星，輪流閃 */
.st-stars { position: relative; display: flex; justify-content: center; gap: 26px; margin-bottom: 2px; }
.st-stars i { font-style: normal; font-size: 40px; line-height: 1; color: #fff6c4; text-shadow: 0 0 3px #fff, 0 0 10px #ffc21a, 0 0 22px #ffb000, 0 0 44px #ff9500;
  animation: n-blink 1.5s steps(1) infinite; }
.st-stars i:nth-child(2n) { animation-delay: 0.75s; }
.st-stars i:nth-child(3) { font-size: 52px; }
.st-main { position: relative; margin-top: 0; font-family: 'Tilt Neon', 'Overpass', sans-serif; font-size: 108px; line-height: 1.05; letter-spacing: 0.02em; white-space: nowrap; }
.st-main span { display: inline-block; }
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
  font-size: 32px; font-weight: 800; letter-spacing: 0.1em; text-shadow: 0 0 8px rgba(214, 160, 255, 0.9); }
.st-sub i { font-style: normal; font-size: 18px; color: #ff6fc1; text-shadow: 0 0 8px #ff2d95; }
@media (prefers-reduced-motion: reduce) { .st-sign, .st-tube, .st-sub, .st-sub span, .st-sub i, .n-pink, .n-cyan, .n-cyan b, .st-stars i { animation: none; } }
</style>
