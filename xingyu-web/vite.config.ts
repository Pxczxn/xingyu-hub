import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./", import.meta.url)),
        "next/link": fileURLToPath(new URL("./src/vite/router.tsx", import.meta.url)),
        "next/navigation": fileURLToPath(new URL("./src/vite/next-navigation.ts", import.meta.url)),
        "next/image": fileURLToPath(new URL("./src/vite/next-image.tsx", import.meta.url)),
      },
    },
    server: {
      host: "localhost",
      port: 7777,
      strictPort: true,
      proxy: {
        "/api/v1": {
          target: env.VITE_API_TARGET ?? "http://127.0.0.1:7779",
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              const token = proxyRes.headers["satoken"];
              if (token) {
                proxyRes.headers["access-control-expose-headers"] = "satoken";
              }
            });
          },
        },
      },
    },
    preview: { host: "localhost", port: 7777, strictPort: true },
  };
});
