import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * 浏览器测试前端。开发用的 vite.config.ts 继续占用 7777，并代理到 7779。
 * 启动：npm run dev:browser-test
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 7781,
    strictPort: true,
    proxy: {
      "/api/v1": {
        target: "http://127.0.0.1:7789",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:7789",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
