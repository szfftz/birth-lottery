import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base './'：放到 GitHub Pages 子路徑（/birth-lottery/）也讀得到
// host：同一個 Wi-Fi 的手機可以直接開（終端機會印出 Network 網址）
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: { port: 8081, host: true, open: true },
})
