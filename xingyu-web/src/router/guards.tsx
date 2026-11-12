import type { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "@/features/auth/auth.store";
import { AUTH_PATHS, sanitizeInAppPath } from "@/features/onboarding/post-login-routing";

/**
 * Auth guard: unauthenticated visitors are redirected to /login and the
 * originally requested path is preserved so login can send them back.
 * The guest-side counterpart of this guard is {@link GuestOnly}.
 * There are still no role/permission guards.
 *
 * The return path travels as the `?returnTo=` query parameter, because that is
 * what LoginPage actually reads (`params.get("returnTo")`). It previously used
 * `state.from`, which nothing consumed — so a guest bounced off /studio used to
 * land on "/" after signing in. MeRedirectPage and ForceChangePasswordPage
 * already used the query form; this makes the guard consistent with them.
 *
 * 强制改密全局入口（2026-10-08）：登录后如果账号处于 mustChangePassword 状态，
 * 后端 `CommunityAuthInterceptor` 会对除 `GET /api/v1/me` 与
 * `POST /api/v1/me/password/force-change` 之外的所有接口返回 403 AUTH_FORBIDDEN。
 * 此前前端守卫只判断「是否登录」，于是直接进入 /studio 或刷新受保护页面时，
 * 页面正常渲染但所有数据请求静默 403 —— 用户看到的是空页面，没有任何可恢复导航。
 * 这里补上最小守卫：登录态 + mustChangePassword === true 时一律改道
 * /force-change-password。白名单（/me 语义的只读接口与强制改密页自身）不在本组
 * 守卫内，因此不会产生重定向循环。
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, status, user } = useAuth();
  const location = useLocation();

  // While the session is being restored we must not redirect prematurely.
  if (status === "initializing") {
    return (
      <div role="status" aria-live="polite" data-testid="auth-guard-loading">
        正在加载…
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  // 必须改密期间，任何受保护页面都改道强制改密页，避免"页面能开、数据全 403"。
  // 目标路径写死，不携带 returnTo —— 改密完成后统一回首页，绕开循环风险。
  if (user?.mustChangePassword) {
    return <Navigate to="/force-change-password" replace />;
  }

  return <>{children}</>;
}

/**
 * AUTH_PATHS entries are "somewhere else a login-lookalike screen lives".
 * Sending an authenticated reader there would land on another guest-only page,
 * which would immediately redirect again — or, for `/login`, replace the URL
 * with itself and paint nothing. `buildLoginPath()` already keeps auth screens
 * out of `returnTo`; this mirrors that shared contract (AUTH_PATHS is exported
 * for exactly this "is the target another auth page" question) instead of
 * inventing a second list.
 */
function isAuthLanding(path: string): boolean {
  return AUTH_PATHS.some(
    (authPath) =>
      path === authPath ||
      path.startsWith(`${authPath}?`) ||
      path.startsWith(`${authPath}/`) ||
      path.startsWith(`${authPath}#`),
  );
}

/**
 * Guest-only guard (audit A1, 2026-11-10 — the other half).
 *
 * `/login` and `/register` are screens for people who are NOT signed in. Without
 * this guard an authenticated reader could sit on /login, mistype a password and
 * fire the login endpoint, or get signed out of a healthy session by some older
 * failure path. The guest pages now bounce to where the reader was headed.
 *
 * `returnTo` is the same query parameter `RequireAuth` writes and `LoginPage`
 * reads, sanitized with the project's one implementation
 * (`sanitizeInAppPath`) — no second open-redirect ruleset. Unknown / external
 * shapes fall back to "/".
 *
 * `initializing` shows the same loading placeholder as RequireAuth: the session
 * restore has not answered yet, and rendering the form first would flash a login
 * screen in front of a signed-in reader.
 */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === "initializing") {
    return (
      <div role="status" aria-live="polite" data-testid="guest-guard-loading">
        正在加载…
      </div>
    );
  }

  // `error` (token stored but /me unreachable) stays on the guest page: logging in
  // is the recovery path, and the token was never proven dead.
  if (status !== "authenticated") {
    return <>{children}</>;
  }

  const requested = sanitizeInAppPath(params.get("returnTo") ?? "", "/");
  return <Navigate to={isAuthLanding(requested) ? "/" : requested} replace />;
}
