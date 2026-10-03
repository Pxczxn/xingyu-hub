import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppProviders } from "./providers/AppProviders";
import { AppRoutes } from "@/router/routes";
import { RouteErrorPage } from "@/components/shared/RouteErrorPage";

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
    /*
     * Router-level fallback (2026-10-03).
     *
     * The app had no error boundary at all before this — a whole-repo grep for
     * `ErrorBoundary` / `componentDidCatch` returned zero hits, so any render
     * throw unmounted the whole tree and the reader got a blank page (or a raw
     * stack trace in dev) with no way back.
     *
     * This one catches what escapes AppLayout's inner boundary: a failure in the
     * shell, in a provider, or during route matching. It renders OUTSIDE
     * AppProviders, which is exactly why RouteErrorPage uses no context.
     */
    errorElement: <RouteErrorPage />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
