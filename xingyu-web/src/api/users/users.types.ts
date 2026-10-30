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
  /** Creator/settings response field; not returned by public GET /users/{username}. */
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
  /** Public PUBLISHED moments, counted server-side on GET /users/{username}. */
  momentCount?: number;
};

/*
 * Works element shape — re-verified against the live backend 2026-10-25.
 * `GET /api/v1/users/{username}/works` actually returns three more fields than
 * this type used to declare. They are typed here because the profile now renders
 * them; both are optional and MUST degrade when absent.
 *
 *   publishedAt    — Instant, serialized as `2026-09-27T17:07:18Z`. Real.
 *   likeCount      — int from engagementMetricsService.likeCounts("ARTICLE", ...). Real.
 *   bookmarkCount  — int from bookmarkCounts("ARTICLE", ...). Real.
 *
 * Deliberately NOT typed, because they are not trustworthy:
 *   pinned         — CreationSpaceService.listPublishedWorks falls back to
 *                    `drafts.get(0).articleId()` when the space has no explicit
 *                    pinnedArticleId, so the newest article is always "pinned".
 *                    Rendering a 置顶 badge from it would label an arbitrary item.
 *   viewCount      — hard-coded `0L` at CreationSpaceService.java:273. Rendering
 *                    it would display a fabricated zero as real data.
 */
export type SpaceWorkItem = {
  id: string;
  title: string;
  categorySlug?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  likeCount?: number | null;
  bookmarkCount?: number | null;
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
 * Block contract — verified against the live backend 2026-09-23 (Phase 2A-2a).
 * Read from CommunityMeController + UserBlockService + BlockedUserView:
 *
 *   GET    /api/v1/me/blocks              -> BlockedUser[]  (200)
 *   POST   /api/v1/me/blocks/{username}   -> 204
 *   DELETE /api/v1/me/blocks/{username}   -> 204
 *
 * The path variable is a USERNAME, not a userId.
 *
 * Response shape is a bare array (no envelope) and `limit` is the only query
 * parameter (default 50) — there is NO cursor/pagination. `blockedAt` is the
 * `user_block.created_at` instant.
 *
 * ⚠️ CONTRACT GAP (Phase 2A-2a): neither `UserDetailView` (GET /users/{username})
 * nor any other endpoint reports whether the viewer has blocked a user. The ONLY
 * way to read block state is this list, so the UI reads it once per session
 * through the shared store instead of re-downloading it on every profile view.
 */
export type BlockedUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  blockedAt?: string | null;
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
