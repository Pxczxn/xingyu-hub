import { communityApi } from "@/lib/community-api";

const AUTH_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"];

export function shouldSkipOnboardingGate(returnTo: string): boolean {
  if (returnTo.startsWith("/onboarding")) return true;
  return AUTH_PATHS.some((path) => returnTo === path || returnTo.startsWith(`${path}?`));
}

export async function resolvePostLoginPath(returnTo: string): Promise<string> {
  if (shouldSkipOnboardingGate(returnTo)) return returnTo;
  try {
    const onboarding = await communityApi.getOnboarding();
    if (!onboarding.completed) return "/onboarding";
  } catch {
    // ignore — fall through to returnTo
  }
  return returnTo;
}
