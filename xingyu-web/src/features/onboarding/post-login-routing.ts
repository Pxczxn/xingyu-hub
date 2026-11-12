import { onboardingApi } from "@/api/onboarding/onboarding.api";

/**
 * 认证域自身的路由。登录引导要用它判断"回跳目标是不是又一个登录页"，
 * 所以这个清单是共享契约，不再只是本模块内部细节。
 */
export const AUTH_PATHS = [
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/force-change-password",
];

/**
 * Login-gate helpers (Phase 2A-3).
 *
 * The GET lives HERE, not in RequireAuth / AuthProvider: one extra request at
 * login, never on every route change. Fail-open (GET error -> the sanitized
 * return path) matches the verified "do not block login" decision. The raw
 * query is never handed to the router.
 */
export function shouldSkipOnboardingGate(returnTo: string): boolean {
  if (
    returnTo === "/onboarding" ||
    returnTo.startsWith("/onboarding/") ||
    returnTo.startsWith("/onboarding?")
  ) {
    return true;
  }
  return AUTH_PATHS.some((path) => returnTo === path || returnTo.startsWith(`${path}?`));
}

export function buildOnboardingPath(returnTo: string): string {
  const safe = sanitizeInAppPath(returnTo, "/");
  if (safe === "/") return "/onboarding";
  return `/onboarding?returnTo=${encodeURIComponent(safe)}`;
}

export function resolveOnboardingExitPath(returnTo: string | null): string {
  const raw = returnTo ?? "";
  if (raw === "/onboarding" || raw.startsWith("/onboarding/") || raw.startsWith("/onboarding?")) {
    return "/";
  }
  return sanitizeInAppPath(raw, "/");
}

export async function resolvePostLoginPath(returnTo: string): Promise<string> {
  const safe = sanitizeInAppPath(returnTo, "/");
  if (shouldSkipOnboardingGate(safe)) return safe;
  try {
    const onboarding = await onboardingApi.get();
    if (!onboarding.completed) return buildOnboardingPath(safe);
  } catch {
    return safe;
  }
  return safe;
}

/**
 * Keep a return path inside this app.
 *
 * `/\evil.example` starts with a single slash, but the URL parser treats the
 * backslash as a slash and resolves it to `https://evil.example/`. Reject that
 * shape, and anything else whose parsed origin is not the dummy app origin,
 * before React Router throws "External navigation is not allowed".
 */
const IN_APP_ORIGIN = "https://xingyu.invalid";

export function sanitizeInAppPath(raw: string, fallback: string): string {
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // eslint-disable-next-line no-control-regex -- intentional security check for control characters in URL paths
  if (raw.includes("\\") || /[\u0000-\u001F]/.test(raw)) return fallback;
  try {
    const url = new URL(raw, IN_APP_ORIGIN);
    if (url.origin !== IN_APP_ORIGIN) return fallback;
    if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
