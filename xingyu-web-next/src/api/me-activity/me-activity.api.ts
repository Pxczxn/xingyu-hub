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
 * There is deliberately no `history()` here: `/me/history` has no backend
 * route at all (see the types file). Adding one would ship a control that can
 * only ever fail.
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
