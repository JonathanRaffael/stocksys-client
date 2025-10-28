import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // teruskan semua request /api ke server Express kamu
      '/api': {
        target: 'http://localhost:3001', // ganti kalau port API beda
        changeOrigin: true,
      },
    },
  },
})
