import { Suspense } from "react";
import { Link, Outlet } from "react-router-dom";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/**
 * Centered layout for auth screens.
 *
 * WIDTH VARIANTS (2026-10-03)
 * ---------------------------
 * The layout used to hard-code `max-w-md` for every auth page. That is right for
 * a form — a single column of controls gains nothing from more width, it just
 * grows margins — but it makes a two-column screen impossible: `/register` wants
 * a form beside a "what you get" panel, and 448px cannot hold both.
 *
 * So the width is a variant rather than a constant, and the ROUTE TABLE picks it:
 *
 *   narrow (default)  login, forgot/reset password, verify-email,
 *                     pending-audit, force-change-password — all single-column
 *   wide              register — form plus the reason to fill it in
 *
 * It is deliberately NOT a global widening. Every page that has no use for the
 * extra width keeps the narrow column, so the change is visible only where it
 * earns its place.
 *
 * Note the two `<AuthLayout />` route groups in router/routes.tsx: the variant is
 * declared per group, which is why this is a prop and not something the layout
 * infers. The layout cannot infer it — the app mounts `<Routes>` declaratively
 * inside a splat route, so `useMatches()` sees only that one splat match and
 * cannot report which child auth page is active.
 *
 * P1-1: same Suspense boundary as AppLayout — every auth page is `lazy()` too,
 * so the shared header stays mounted while the page chunk downloads.
 */
export type AuthLayoutWidth = "narrow" | "wide";

const WIDTH_CLASS: Record<AuthLayoutWidth, string> = {
  narrow: "max-w-md",
  wide: "max-w-4xl",
};

export function AuthLayout({ width = "narrow" }: { width?: AuthLayoutWidth }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="border-b border-border">
        <div className="content-shell flex items-center py-3">
          <Link to="/" className="text-lg font-semibold text-primary">
            星语
          </Link>
        </div>
      </header>
      <main className="content-shell flex flex-1 items-center justify-center py-8">
        <div className={cn("w-full", WIDTH_CLASS[width])}>
          <Suspense fallback={<PageState kind="loading" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
