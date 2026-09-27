/*
 * "我的互动" contracts — what you liked and what you said.
 *
 * VERIFIED 2026-09-27 against source + live probe (Phase 2J-1):
 *
 *   GET /api/v1/me/likes?limit=20     bare MyLikeView[]    401 without session
 *   GET /api/v1/me/comments?limit=20  bare MyCommentView[] 401 without session
 *
 * Both live in `CommunityMeController @RequestMapping("/me")` and both return a
 * BARE ARRAY — no `PageResultView` wrapper, no `nextCursor`, no `total`. The
 * client therefore cannot paginate: `limit` means "how far back to look", not
 * "page size". Do not render a "load more" control against these.
 *
 * `/me/history` DOES NOT EXIST on the backend. It appears in Legacy's
 * `screen-registry.ts` as a label ("阅读历史") but no controller declares it and
 * no Legacy client ever calls it. It is a registry entry, not a feature.
 *
 * Shape notes that change what the UI can honestly claim:
 *  - `MyLikeView` has NO `id`, NO username, NO cover and NO likeCount. The row
 *    is keyed by `objectType:objectId` (which is why the list UI builds its
 *    React key from both).
 *  - `MyLikeView.title` falls back to the raw `objectId` server-side when the
 *    target has no `search_document` row (`document == null ? like.getObjectId()
 *    : document.getTitle()`). A title equal to the id is a real observable
 *    state, not a rendering bug.
 *  - `MyCommentView.objectTitle` has the identical fallback.
 *  - Comments are filtered to `status = 'VISIBLE'` in SQL, so a comment the user
 *    wrote that was later hidden simply will not appear. The UI must not say
 *    "全部评论" — it shows the visible ones.
 *  - Likes have NO status column: unliking deletes the row. So this list is
 *    exactly "currently liked", never "liked at some point in the past".
 */

/**
 * One like, as returned by `GET /api/v1/me/likes`.
 *
 * There is no `id` field — `objectType` + `objectId` is the composite key.
 */
export type MyLikeView = {
  objectType: string;
  objectId: string;
  /** Falls back to `objectId` server-side when the target has no search doc. */
  title: string;
  createdAt: string;
};

/**
 * One comment, as returned by `GET /api/v1/me/comments`.
 *
 * `id` is the comment's own id (`/comments/:id` in Legacy), but V2 ships no such
 * route, so the row links to the *commented content* via `objectType`/`objectId`
 * — the same destination Legacy chose.
 */
export type MyCommentView = {
  id: string;
  body: string;
  objectType: string;
  objectId: string;
  /** Falls back to `objectId` server-side when the target has no search doc. */
  objectTitle: string;
  createdAt: string;
};

/** The backend's own default when `limit` is omitted (`defaultValue = "20"`). */
export const MY_ACTIVITY_LIMIT = 20;
