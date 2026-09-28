import type { UpdateMyProfilePayload } from "@/api/users/users.types";

/*
 * PROFILE step payload (Phase 2A-3).
 *
 * Same endpoint as Settings: PATCH /api/v1/me/profile, partial merge.
 * Empty strings return 200 but do not clear (verified 2026-09-24); so a blank
 * field is omitted rather than sent. Unchanged fields are omitted too.
 * Returns null when there is nothing safe to write — the step can still advance
 * via the onboarding PATCH alone.
 */
export function buildOnboardingProfilePatch(
  lockVersion: number,
  baseline: { displayName: string; bio: string },
  current: { displayName: string; bio: string },
): UpdateMyProfilePayload | null {
  const payload: UpdateMyProfilePayload = { lockVersion };
  const nextName = current.displayName.trim();
  const nextBio = current.bio.trim();
  const baseName = baseline.displayName.trim();
  const baseBio = baseline.bio.trim();
  if (nextName !== baseName && nextName !== "") payload.displayName = nextName;
  if (nextBio !== baseBio && nextBio !== "") payload.bio = nextBio;
  if (payload.displayName === undefined && payload.bio === undefined) return null;
  return payload;
}
