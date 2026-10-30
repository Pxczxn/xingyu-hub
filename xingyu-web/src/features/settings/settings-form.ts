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
 * The backend stores three values and all three now have distinct behaviour
 * (2026-10-30): PUBLIC is listed and readable by anyone; UNLISTED is absent from
 * search but readable through a direct link; PRIVATE is readable only by the
 * owner, and every public profile surface returns 404 to everyone else.
 *
 * `CommunityProfileService.requireVisibleProfile` evaluates AccessPolicy with the
 * viewer's identity, so the owner is the only non-404 reader of a PRIVATE profile.
 * Registration still writes PRIVATE, so new accounts start hidden until the owner
 * changes this setting.
 */
export type ProfileVisibilityChoice = "PUBLIC" | "UNLISTED" | "PRIVATE";

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
  { value: "PUBLIC", label: "公开", hint: "会出现在搜索结果里，任何人都能打开你的主页" },
  {
    value: "UNLISTED",
    label: "不列出",
    hint: "不出现在搜索结果里；知道链接的人仍然可以打开你的主页",
  },
  {
    value: "PRIVATE",
    label: "仅自己",
    hint: "只有你自己能看到你的主页；其他人打开会显示不存在",
  },
];

/**
 * Keep the stored enum. PRIVATE is a real choice now, not an alias for UNLISTED;
 * only an unknown value falls back to the safe 不列出 side.
 */
export function toVisibilityChoice(stored: unknown): ProfileVisibilityChoice {
  return stored === "PUBLIC" || stored === "UNLISTED" || stored === "PRIVATE" ? stored : "UNLISTED";
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
    visibility: isVisibility(profile.visibility)
      ? toVisibilityChoice(profile.visibility)
      : "UNLISTED",
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
