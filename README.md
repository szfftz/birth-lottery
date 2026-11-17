# 出生搖搖樂 Birth Lottery

網頁：https://szfftz.github.io/birth-lottery/

從 K30DayMapChallenge 2026 Day 25（Is this a map?）搬出來的手機版：872 顆國旗彩球放進 3D 樂透搖獎機，掉出哪一國就投胎到哪一國，獎品是那一國的人類發展指數（HDI）。

- 手機優先（RWD）：舞台佔滿整個手機畫面，下面浮著一條玻璃操作列：模式選單（漢堡）、DRAW、資訊；結果（含國家在世界地圖的位置）、歷史、獎項（含統計）、說明收在從下面拉上來的「資訊」面板
- 電腦上也是手機寬度（最寬 430px，置中）
- 模式：地圖、彩球、排列、格子、盒子・地圖、盒子・照獎、遊戲（預設遊戲）
- Vue 3 + Vite + three.js + MapLibre

```bash
npm install
npm run serve    # 開發（同一個 Wi-Fi 的手機開終端機印出的 Network 網址）
npm run build    # 建置到 dist/
npm run deploy   # 建置並推到 gh-pages → https://szfftz.github.io/birth-lottery/
```

資料（`src/data/`）是 Day 25 的 build 結果：`lottery.json`（人口、HDI）、`balls.json`（每國球數）、`tiers.json`（獎項切點）、`flags.json`／`flags.png`（國旗拼圖）、`cells.json`（格子模式的排法）、`countries-50m.geojson`（Natural Earth 國界，只留用到的欄位、座標取到小數 3 位）。
