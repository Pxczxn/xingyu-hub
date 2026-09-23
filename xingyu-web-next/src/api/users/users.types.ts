/*
 * User / profile domain types.
 * Shapes verified against the live backend GET /api/v1/users/{username} (2026-09-21).
 */

export type ProfileDetail = {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  websiteUrl?: string | null;
  visibility?: string;
  followersVisibility?: string;
  lockVersion?: number;
  followerCount?: number;
  followingCount?: number;
  canViewFollowLists?: boolean;
  owner?: boolean;
  following?: boolean;
  spaceSlug?: string | null;
  spaceDisplayName?: string | null;
  articleCount?: number;
  seriesCount?: number;
};

export type SpaceWorkItem = {
  id: string;
  title: string;
  categorySlug?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
};

export type SpaceWorks = {
  username: string;
  spaceSlug: string;
  displayName?: string | null;
  description?: string | null;
  owner: boolean;
  categories: Array<{ id: string; name: string; slug: string }>;
  works: SpaceWorkItem[];
  nextCursor?: string | null;
};

export type FollowUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  followedAt?: string;
};

/*
 * Profile write contract — verified against the live backend 2026-09-22
 * (Phase 2-0 §6.4.1) and re-read from CommunityProfileService.updateProfile.
 *
 * PATCH /api/v1/me/profile accepts a patch body; only the keys actually present
 * are touched (`body.containsKey(...)`), so callers must send ONLY what changed.
 *
 *   lockVersion  — optional. Omitted => the backend uses the stored version and
 *                  never conflicts. Supplied => mismatch is a 409 CONFLICT.
 *                  Always supplied by the Settings form so concurrent edits surface.
 *   displayName  — trimToNull: blank becomes null
 *   bio          — trimToNull: blank becomes null
 *   websiteUrl   — must parse as a URI with an http/https scheme, else 400
 *   visibility   — PUBLIC | PRIVATE | UNLISTED (backend upper-cases), else 400
 *
 * ⚠️ CLEARING IS NOT SUPPORTED. `CommunityProfile.updateById` uses MyBatis-Plus'
 * default field strategy (NOT_NULL), so a column set to null is omitted from the
 * generated UPDATE. Sending "" or null therefore returns 200 while silently
 * keeping the old value — and still bumps lockVersion. The Settings form blocks
 * such submissions instead of pretending they worked (see settings-form.ts).
 */
export type ProfileVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export type UpdateMyProfilePayload = {
  lockVersion?: number;
  displayName?: string;
  bio?: string;
  websiteUrl?: string;
  visibility?: ProfileVisibility;
};

/** PATCH /api/v1/me/profile/privacy — only followersVisibility exists. */
export type FollowersVisibility = "PUBLIC" | "PRIVATE";

export type UpdateMyPrivacyPayload = {
  followersVisibility?: FollowersVisibility;
};
