import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import "@/styles/globals.css";

// 开发环境：启用触摸目标检查
if (import.meta.env.DEV) {
  import("@/lib/touch-target-checker");
}

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
