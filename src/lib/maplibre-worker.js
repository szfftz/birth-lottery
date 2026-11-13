// MapLibre v6 預設到 maplibre-gl.mjs 旁邊找 worker，被 Vite 打包後路徑會錯（404），
// 改由 Vite 把 worker 連同依賴打包成獨立檔，再把網址告訴 MapLibre
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
