import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "@/router/routes";

/**
 * Web V2 application root.
 * Single routing system: React Router. No Next.js shim, no Legacy custom router.
 *
 * Phase 1C-2 switched the root from the declarative <BrowserRouter> to a DATA
 * router. Reason: the editor's unsaved-changes protection uses React Router's
 * official `useBlocker`, which throws "useBlocker must be used within a data
 * router" under a declarative router. No history monkey-patching is involved.
 *
 * The route table itself is untouched: one splat route hands path matching back
 * to <AppRoutes/>, exactly as before.
 */
const router = createBrowserRouter([
  {
    path: "*",
    element: (
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    ),
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
