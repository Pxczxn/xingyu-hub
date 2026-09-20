import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Web V2 foundation. No Next.js shim, no Legacy custom router, no Legacy screen inventory.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Keep the /api/v1 backend contract; proxy to the local backend dev server.
      "/api/v1": {
        target: "http://127.0.0.1:7779",
        changeOrigin: true,
      },
    },
  },
});
