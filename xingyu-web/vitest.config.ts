import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "next/link": fileURLToPath(new URL("./src/vite/router.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./src/vite/next-navigation.ts", import.meta.url)),
      "next/image": fileURLToPath(new URL("./src/vite/next-image.tsx", import.meta.url)),
    },
  },
});
