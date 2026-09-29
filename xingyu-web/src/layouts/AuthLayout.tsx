import { Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { PageState } from "@/components/shared/PageState";

/**
 * Minimal centered layout for auth screens (Phase 0: login only).
 *
 * P1-1: same Suspense boundary as AppLayout — every auth page is `lazy()` too,
 * so the shared header stays mounted while the page chunk downloads.
 */
export function AuthLayout() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border">
        <div className="content-shell flex items-center py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            星语
          </Link>
        </div>
      </header>
      <main className="content-shell flex flex-1 items-center justify-center">
        <div className="w-full max-w-md">
          <Suspense fallback={<PageState kind="loading" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
