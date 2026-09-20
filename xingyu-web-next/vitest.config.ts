/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

/*
 * No @vitejs/plugin-react here on purpose:
 * vitest 3.x bundles its own Vite, whose Plugin type is incompatible with the
 * Vite 8 (rolldown) plugin used by vite.config.ts. Tests only need the JSX
 * transform, which esbuild already provides via tsconfig `jsx: react-jsx`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
