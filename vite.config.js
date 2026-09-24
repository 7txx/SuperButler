import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 本地开发时前端 5173 端口，/api 请求代理到 wrangler dev 的 8787 端口
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500
  }
})
