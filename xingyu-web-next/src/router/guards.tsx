import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth.store";

/**
 * Auth guard: unauthenticated visitors are redirected to /login and the
 * originally requested path is preserved so login can send them back.
 * Phase 0 only has this one guard (no role/permission guards yet).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();

  // While the session is being restored we must not redirect prematurely.
  if (status === "idle" || status === "loading") {
    return <div role="status" aria-live="polite" data-testid="auth-guard-loading">正在加载…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
