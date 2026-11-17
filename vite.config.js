import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './'：放到 GitHub Pages 子路徑（/birth-lottery/）也讀得到
// host：同一個 Wi-Fi 的手機可以直接開（終端機會印出 Network 網址）
export default defineConfig({
  base: './',
  plugins: [vue()],
  // MapLibre 的 worker 是 ES module（見 src/lib/maplibre-worker.js）
  worker: { format: 'es' },
  // three.js、Vue 各自一包：平行下載，而且改 app 程式之後這兩包不用重新下載（瀏覽器有快取）
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], vue: ['vue'] } } } },
  server: { port: 8085, strictPort: true, host: true, open: true },
})
