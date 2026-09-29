/*
 * Social / follow graph contract (Phase 2I-1, four-source confirmed 2026-09-27).
 *
 * Controller: CommunityMeController   @RequestMapping("/me")
 *             CommunityUserController @RequestMapping("/users")
 * DTO:        FollowUserView {userId, username, displayName, followedAt}
 *             PageResultView<T> {items, nextCursor, total}
 *
 * Endpoints:
 *   GET    /api/v1/me/following?limit=N              -> PageResult<FollowUser>   (session)
 *   GET    /api/v1/me/followers?limit=N              -> PageResult<FollowUser>   (session)
 *   GET    /api/v1/users/{username}/following?limit= -> PageResult<FollowUser>   (public-ish)
 *   GET    /api/v1/users/{username}/followers?limit= -> PageResult<FollowUser>
 *   POST   /api/v1/users/{username}/follow           -> 204   (session)
 *   DELETE /api/v1/users/{username}/follow           -> 204   (session)
 *
 * Two important shapes:
 *  - The list endpoints return PageResultView, NOT a bare array: read `.items`.
 *    `nextCursor` is always null here (no cursor paging) — `limit` is the only
 *    knob, so paging is client-side over the fetched window.
 *  - `followedAt` is an Instant; it can be absent, so treat it as optional and
 *    never render "Invalid Date".
 *
 * Both follow writes are idempotent (204 on an already-followed user, and on
 * unfollowing a non-followed one). Only the writes need a session; a missing
 * session is 401 AUTH_REQUIRED, not 403.
 *
 * Verified live: GET /api/v1/me/following without a token -> 401
 *   {"code":"AUTH_REQUIRED","detail":"请先登录"} (endpoint exists; it is not 404).
 */

export type FollowUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  followedAt?: string | null;
};

/** The shape these endpoints actually return — a wrapper, not an array. */
export type FollowPage = {
  items: FollowUser[];
  nextCursor?: string | null;
  total?: number | null;
};

/**
 * Defensive unwrap: the contract says PageResult, but tolerate a bare array so a
 * future backend simplification cannot blank the whole page.
 */
export function toFollowUsers(raw: FollowPage | FollowUser[] | null | undefined): FollowUser[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.items) ? raw.items : [];
}
