import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('naive-ui')) return 'vendor-naive'
          if (id.includes('@xterm')) return 'vendor-terminal'
          if (id.includes('echarts')) return 'vendor-charts'
          if (id.includes('@vicons')) return 'vendor-icons'
          if (id.includes('axios')) return 'vendor-http'
        }
      }
    }
  },
  server: {
    port: 7778,
    proxy: {
      '/api': {
        target: 'http://localhost:7779',
        changeOrigin: true
      },
      '/druid': {
        target: 'http://localhost:7779',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:7779',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
