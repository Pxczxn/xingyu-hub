import { onboardingApi } from "@/api/onboarding/onboarding.api";

const AUTH_PATHS = [
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
 * login, never on every route change. Fail-open (GET error -> original returnTo)
 * matches the verified "do not block login" decision.
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
  if (shouldSkipOnboardingGate(returnTo)) return returnTo;
  try {
    const onboarding = await onboardingApi.get();
    if (!onboarding.completed) return buildOnboardingPath(returnTo);
  } catch {
    return returnTo;
  }
  return returnTo;
}

function sanitizeInAppPath(raw: string, fallback: string): string {
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}
