/*
 * Moment contracts — verified live 2026-09-24 (isolated test DB, Phase 2D probe).
 * Extended 2026-09-27 (Phase 2I-5, source + live probe).
 *
 * GET  /api/v1/moments?limit=N     bare MomentView[]  (PUBLISHED only)
 * POST /api/v1/moments             { body } → 200 MomentView   (no draft state)
 * GET  /api/v1/moments/{id}        200 MomentView / 404        (404 unless PUBLISHED)
 * PATCH /api/v1/moments/{id}       { body } → 200 / 400 / 404 / 409
 * POST /api/v1/moments/{id}/trash  200 MomentView (no longer publicly readable)
 * GET  /api/v1/me/moments?limit=N  owner PUBLISHED list (owner-control only)
 * GET  /api/v1/me/insights         InsightsView (session-scoped counters)
 *
 * MomentView has no status / username / likeCount. UNLISTED-style privacy
 * does not apply; trash is observed as GET 404.
 *
 * TWO PARALLEL WRITE PATHS EXIST. `CommunityMomentController` (`/moments`) and
 * `CommunityMeController` (`/me/moments`) both expose PATCH and POST /trash.
 * The V2 client uses the `/moments` pair and only reads `/me/moments`.
 */

export type MomentView = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
};

/**
 * `GET /api/v1/me/insights` — the session user's own counters.
 *
 * Every field is a plain `long` server-side, so they are always present and
 * never null. Note `articleCount` is PUBLISHED only while `draftCount` is
 * DRAFT only; `IN_REVIEW` appears in neither.
 */
export type InsightsView = {
  articleCount: number;
  draftCount: number;
  followerCount: number;
  followingCount: number;
  commentCount: number;
  likeCount: number;
};

export type MomentBodyPayload = {
  body: string;
};

export const MOMENT_EDIT_WINDOW_SECONDS = 1800;
export const OWNER_LIST_LIMIT = 1000;
export const FEED_LIMIT = 20;

/** The owner page asks for a bounded page of its own history, not the whole feed. */
export const MY_MOMENTS_LIMIT = 50;
