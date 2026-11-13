# 投胎樂透 Birth Lottery

從 K30DayMapChallenge 2026 Day 25（Is this a map?）搬出來的手機版：891 顆國旗彩球放進 3D 樂透搖獎機，掉出哪一國就投胎到哪一國，獎品是那一國的人類發展指數（HDI）。

- 手機優先（RWD）；電腦上也是手機寬度（最寬 430px，置中）
- Vue 3 + Vite + three.js

```bash
npm install
npm run serve    # 開發（同一個 Wi-Fi 的手機開終端機印出的 Network 網址）
npm run build    # 建置到 dist/
npm run deploy   # 建置並推到 gh-pages → https://szfftz.github.io/birth-lottery/
```

資料（`src/data/`）是 Day 25 的 build 結果：`lottery.json`（人口、HDI）、`balls.json`（每國球數）、`tiers.json`（獎項切點）、`flags.json`／`flags.png`（國旗拼圖）。
