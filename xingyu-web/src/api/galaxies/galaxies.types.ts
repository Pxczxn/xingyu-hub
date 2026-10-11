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
 * Notes (Galaxy Identity & Content Contract, verified 2026-10-10 Phase 4.2):
 *  - Every galaxy route is keyed by `slug`, never by id. There is no /galaxies/{id}.
 *  - `GET /galaxies` ignores `limit` and returns every galaxy. List items carry
 *    `joinMode` but NEVER `joined` (no per-row viewer queries); the detail
 *    endpoint is the only source of the viewer-scoped `joined` tri-state.
 *  - `joined`: true/false for signed-in viewers, null/absent for guests —
 *    "unknown" must never render as "not joined".
 *  - `joinMode` (OPEN/APPROVAL) drives the join control directly: OPEN joins in
 *    one call; APPROVAL goes straight to /apply. The old join→409→apply probe
 *    and the listMine full-scan are gone.
 *  - `description`/`coverUrl` come from V051 columns (null until content is
 *    written by admin); render a designed empty state, never fake copy.
 *  - `GalaxyContent` is the shared ContentSummary shape: title/summary/updatedAt
 *    come from live `search_document` rows (removed_at IS NULL — moderated
 *    content disappears from the listing automatically); `cover` is null for
 *    SERIES/MOMENT (no cover source — visual fallback required).
 */

export type GalaxySummary = {
  id: string;
  slug: string;
  name: string;
  official: boolean;
  memberCount: number;
  /** OPEN 直入 / APPROVAL 需申请（列表与详情均有）。 */
  joinMode: string;
  /** viewer-scoped；仅详情端点填充，列表恒缺省。 */
  joined?: boolean | null;
  /** V051；admin 未填写时为 null —— 空值降级，不伪造文案。 */
  description?: string | null;
  /** V051；null 时用确定性装饰图降级。 */
  coverUrl?: string | null;
  /** 已挂载可见内容数（过滤治理隐藏）；仅详情端点填充。 */
  contentCount?: number | null;
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
  /** search_document.summary；admin admin 挂载响应为 null，列表必有。 */
  summary?: string | null;
  /** ARTICLE 才可能有；SERIES/MOMENT 恒 null（无封面源）。 */
  cover?: string | null;
  authorName?: string | null;
  updatedAt?: string | null;
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
