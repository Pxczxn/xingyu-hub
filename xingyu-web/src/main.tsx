import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import { ViteAppRouter } from "./vite/router";

createRoot(document.getElementById("root")!).render(<ViteAppRouter />);
