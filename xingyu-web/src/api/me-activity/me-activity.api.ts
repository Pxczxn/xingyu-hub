/*
 * "我的互动" clients: the two session-scoped trails V2 was missing —
 * what you liked, and what you said.
 *
 * Both endpoints return a bare array (see me-activity.types.ts), so these
 * wrappers intentionally expose no cursor/pagination surface.
 */
import { apiRequest } from "@/api/client";
import type { MyCommentView, MyLikeView } from "./me-activity.types";
import { MY_ACTIVITY_LIMIT } from "./me-activity.types";

/**
 * `GET /api/v1/me/likes` — content the session user currently likes.
 *
 * There is deliberately no `history()` here, but NOT because reading history is
 * missing from the backend — it is not. Reading history lives at a DIFFERENT
 * path, `/me/reading-history` (verified 2026-09-28: 401 AUTH_REQUIRED), and
 * Legacy's own `getHistory()` calls that path. This module simply has no
 * business owning it; it belongs with the reading domain.
 *
 * ⚠️ Do not "restore" a `/me/history` client under the impression it is the
 * reading-history endpoint. `GET /me/history` is a DIFFERENT, non-existent
 * route: it 500s (no handler, no matching guard). The two names are similar;
 * the routes are not the same. See LEGACY-DELTA §三·补3 §1b.
 */
export const myLikesApi = {
  list: (limit: number = MY_ACTIVITY_LIMIT): Promise<MyLikeView[]> =>
    apiRequest<MyLikeView[]>(`/api/v1/me/likes?limit=${limit}`),
};

/**
 * `GET /api/v1/me/comments` — the session user's VISIBLE comments.
 *
 * Named for the session scope rather than the resource: this is never the
 * public comment list of some object, and the call site should read that way.
 */
export const myCommentsApi = {
  list: (limit: number = MY_ACTIVITY_LIMIT): Promise<MyCommentView[]> =>
    apiRequest<MyCommentView[]>(`/api/v1/me/comments?limit=${limit}`),
};
