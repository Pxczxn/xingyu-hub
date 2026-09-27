/*
 * Galaxy contract (Phase 2H live probe 2026-09-27).
 *
 * Public (guest-readable):
 *   GET  /api/v1/galaxies?limit=N            -> GalaxySummary[]
 *   GET  /api/v1/galaxies/{slug}             -> GalaxySummary
 *   GET  /api/v1/galaxies/{slug}/members     -> GalaxyMember[]  (default limit 50)
 *   GET  /api/v1/galaxies/{slug}/content     -> GalaxyContent[] (default limit 20)
 *
 * Member-only (session required):
 *   GET  /api/v1/me/galaxies                 -> GalaxySummary[]  (joined only)
 *   POST /api/v1/galaxies/{slug}/join        -> GalaxySummary
 *   POST /api/v1/galaxies/{slug}/apply       -> GalaxyJoinRequest
 *
 * Notes verified against the running backend:
 *  - Every galaxy route is keyed by `slug`, never by id. There is no /galaxies/{id}.
 *  - `GET /galaxies` ignores `limit` and returns every galaxy.
 *  - A missing slug 404s (ProblemDetails NOT_FOUND) on both detail and
 *    members/content.
 *  - `GalaxySummary` does NOT expose `joinMode`. `join` therefore cannot be
 *    pre-flighted on the client: an APPROVAL galaxy answers POST /join with
 *    409 CONFLICT ("该星系需要申请加入"), and the UI must fall back to /apply.
 *  - `apply` on a non-APPROVAL galaxy joins directly and returns
 *    `status: "APPROVED"` with a null id — that is success, not a pending request.
 *  - `GalaxyContent.title` comes from `search_document`; when no document exists
 *    the service falls back to the raw `objectId`.
 */

export type GalaxySummary = {
  id: string;
  slug: string;
  name: string;
  official: boolean;
  memberCount: number;
};

export type GalaxyMember = {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
  joinedAt: string;
};

export type GalaxyContent = {
  id: string;
  objectType: string;
  objectId: string;
  title: string;
  pinned: boolean;
};

export type GalaxyJoinRequest = {
  id: string;
  galaxyId: string;
  galaxySlug: string;
  galaxyName: string;
  message: string | null;
  status: string;
  createdAt: string;
};
