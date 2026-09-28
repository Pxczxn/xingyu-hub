/*
 * Settings form logic (Phase 2A-1) — pure functions, no React, so the tricky
 * parts (patch payload shape, the cannot-clear guard) are directly unit-testable.
 *
 * Backend contract (CommunityProfileService.updateProfile, verified 2026-09-22):
 *   - patch semantics: only keys present in the body are touched
 *   - displayName / bio go through trimToNull
 *   - websiteUrl must be a URI with an http/https scheme, else 400
 *   - visibility ∈ PUBLIC | PRIVATE | UNLISTED, else 400
 *   - lockVersion mismatch -> 409
 *
 * ⚠️ The cannot-clear rule:
 *   `CommunityProfile` is persisted with MyBatis-Plus `updateById`, whose default
 *   field strategy is NOT_NULL — a column set to null is simply omitted from the
 *   UPDATE. So writing "" (or null) to displayName/bio/websiteUrl returns 200,
 *   keeps the OLD value, and still bumps lockVersion.
 *
 *   The UI must therefore refuse to submit a clear instead of reporting a fake
 *   success. `findClearAttempts` drives that guard.
 */
import type {
  FollowersVisibility,
  ProfileDetail,
  ProfileVisibility,
  UpdateMyProfilePayload,
} from "@/api/users/users.types";

/**
 * The backend stores three values (PUBLIC | PRIVATE | UNLISTED) but only TWO
 * behaviours actually exist. Verified live on 2026-09-22 against the real backend:
 *
 *   PUBLIC    -> listed in search, readable by anyone
 *   UNLISTED  -> absent from search, still readable through a direct link
 *   PRIVATE   -> absent from search, STILL READABLE through a direct link
 *
 * `CommunityProfileService.getPublicProfile` guards with
 * `if (visibility != Visibility.PRIVATE)`, which *skips* the `AccessPolicy`
 * deny branch for PRIVATE — so PRIVATE never actually blocks a stranger.
 * Scrub the echoed `visibility` string and PRIVATE vs UNLISTED responses are
 * byte-identical (profile detail / works / followers / following all matched).
 *
 * PRIVATE is also what registration writes by default
 * (`CommunityAccountService` sets `visibility = "PRIVATE"`).
 *
 * So the UI must NOT offer it as a third option labelled "仅自己": that label
 * promises privacy the backend does not deliver, and the extra choice would be
 * a distinction with no observable difference. We expose the two real
 * behaviours and fold a stored PRIVATE onto 不列出.
 */
export type ProfileVisibilityChoice = "PUBLIC" | "UNLISTED";

export type ProfileFormValues = {
  displayName: string;
  bio: string;
  websiteUrl: string;
  visibility: ProfileVisibilityChoice;
};

export type ProfileFieldName = keyof ProfileFormValues;

/**
 * Fields the backend cannot clear. `visibility` is absent on purpose: it is an
 * enum that always holds a value, so there is nothing to clear.
 */
export const UNCLEARABLE_FIELDS: ProfileFieldName[] = ["displayName", "bio", "websiteUrl"];

export const PROFILE_FIELD_LABELS: Record<ProfileFieldName, string> = {
  displayName: "昵称",
  bio: "简介",
  websiteUrl: "个人网站",
  visibility: "资料可见性",
};

export const VISIBILITY_OPTIONS: Array<{
  value: ProfileVisibilityChoice;
  label: string;
  hint: string;
}> = [
  { value: "PUBLIC", label: "公开", hint: "会出现在搜索结果里" },
  {
    value: "UNLISTED",
    label: "不列出",
    hint: "不出现在搜索结果里；知道链接的人仍然可以打开你的主页",
  },
];

/**
 * Fold the stored enum onto the two behaviours the UI can honestly describe.
 * PRIVATE and UNLISTED are indistinguishable in practice, and PRIVATE is the
 * registration default, so both render as 不列出.
 */
export function toVisibilityChoice(stored: unknown): ProfileVisibilityChoice {
  return stored === "PUBLIC" ? "PUBLIC" : "UNLISTED";
}

export const FOLLOWERS_VISIBILITY_OPTIONS: Array<{ value: FollowersVisibility; label: string }> = [
  { value: "PUBLIC", label: "公开" },
  { value: "PRIVATE", label: "仅自己" },
];

/** Backend trims every text field, so compare trimmed values to avoid phantom edits. */
function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isVisibility(value: unknown): value is ProfileVisibility {
  return value === "PUBLIC" || value === "PRIVATE" || value === "UNLISTED";
}

/** Project a server profile onto the editable form shape. */
export function toProfileFormValues(profile: ProfileDetail): ProfileFormValues {
  return {
    displayName: profile.displayName ?? "",
    bio: profile.bio ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    // Keep isVisibility() as the guard so an unknown enum value cannot silently
    // become "PUBLIC"; anything unexpected folds onto the safe 不列出 side.
    visibility: isVisibility(profile.visibility) ? toVisibilityChoice(profile.visibility) : "UNLISTED",
  };
}

/**
 * Fields the user is trying to blank out that the backend would silently ignore.
 * Empty -> non-empty is fine; non-empty -> empty is the unsupported direction.
 */
export function findClearAttempts(
  baseline: ProfileFormValues,
  current: ProfileFormValues,
): ProfileFieldName[] {
  return UNCLEARABLE_FIELDS.filter(
    (field) => normalize(baseline[field]) !== "" && normalize(current[field]) === "",
  );
}

/** True when at least one field differs from the baseline. */
export function hasProfileChanges(
  baseline: ProfileFormValues,
  current: ProfileFormValues,
): boolean {
  return (
    normalize(baseline.displayName) !== normalize(current.displayName) ||
    normalize(baseline.bio) !== normalize(current.bio) ||
    normalize(baseline.websiteUrl) !== normalize(current.websiteUrl) ||
    baseline.visibility !== current.visibility
  );
}

/**
 * Build the PATCH body for exactly the changed fields.
 *
 * `lockVersion` is always included so a concurrent edit produces a real 409
 * rather than being silently overwritten (omitting it makes the backend adopt
 * the stored version and never conflict).
 */
export function buildProfilePatch(
  baseline: ProfileFormValues,
  current: ProfileFormValues,
  lockVersion: number,
): UpdateMyProfilePayload {
  const payload: UpdateMyProfilePayload = { lockVersion };
  if (normalize(baseline.displayName) !== normalize(current.displayName)) {
    payload.displayName = normalize(current.displayName);
  }
  if (normalize(baseline.bio) !== normalize(current.bio)) {
    payload.bio = normalize(current.bio);
  }
  if (normalize(baseline.websiteUrl) !== normalize(current.websiteUrl)) {
    payload.websiteUrl = normalize(current.websiteUrl);
  }
  if (baseline.visibility !== current.visibility) {
    payload.visibility = current.visibility;
  }
  return payload;
}

/**
 * Client-side mirror of `CommunityProfileService.validateWebsiteUrl`.
 * Blank is allowed here — whether blank is *submittable* is the clear-guard's job.
 * Returns an error message, or null when acceptable.
 */
export function validateWebsiteUrlInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/\s/.test(trimmed)) return "链接格式无效";
  if (!/^https?:\/\//i.test(trimmed)) return "仅支持 http/https 链接";
  return null;
}

export function toFollowersVisibility(value: unknown): FollowersVisibility {
  return value === "PUBLIC" ? "PUBLIC" : "PRIVATE";
}
