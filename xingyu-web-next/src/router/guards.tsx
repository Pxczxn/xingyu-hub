import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth.store";

/**
 * Auth guard: unauthenticated visitors are redirected to /login and the
 * originally requested path is preserved so login can send them back.
 * Phase 0 only has this one guard (no role/permission guards yet).
 *
 * The return path travels as the `?returnTo=` query parameter, because that is
 * what LoginPage actually reads (`params.get("returnTo")`). It previously used
 * `state.from`, which nothing consumed — so a guest bounced off /studio used to
 * land on "/" after signing in. MeRedirectPage and ForceChangePasswordPage
 * already used the query form; this makes the guard consistent with them.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  // While the session is being restored we must not redirect prematurely.
  if (status === "initializing") {
    return <div role="status" aria-live="polite" data-testid="auth-guard-loading">正在加载…</div>;
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
