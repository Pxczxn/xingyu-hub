/*
 * Moment contracts — verified live 2026-09-24 (isolated test DB, Phase 2D probe).
 *
 * GET  /api/v1/moments?limit=N     bare MomentView[]
 * POST /api/v1/moments             { body } → 200 MomentView
 * GET  /api/v1/moments/{id}        200 MomentView / 404
 * PATCH /api/v1/moments/{id}       { body } → 200 / 400 / 404 / 409
 * POST /api/v1/moments/{id}/trash  200 MomentView (no longer publicly readable)
 * GET  /api/v1/me/moments?limit=N  owner PUBLISHED list (owner-control only)
 *
 * MomentView has no status / username / likeCount. UNLISTED-style privacy
 * does not apply; trash is observed as GET 404.
 */

export type MomentView = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
};

export type MomentBodyPayload = {
  body: string;
};

export const MOMENT_EDIT_WINDOW_SECONDS = 1800;
export const OWNER_LIST_LIMIT = 1000;
export const FEED_LIMIT = 20;
