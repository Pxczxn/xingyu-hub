/*
 * Interaction domain API (extracted from the Legacy community API module — NOT the whole file).
 *
 * VERIFIED against the live backend 2026-09-21:
 *   Like      POST/DELETE /api/v1/likes/{objectType}/{objectId}   -> 204 (WORKS)
 *   LikeState GET /api/v1/likes/{ot}/{id}/status                  -> {liked}   (WORKS)
 *   LikeCount GET /api/v1/likes/{ot}/{id}/count                   -> {count}   (WORKS)
 *   Comments  GET  /api/v1/comments/{ot}/{id}                     -> CommentItem[] (auth required)
 *   Comments  POST /api/v1/comments                               -> CommentItem   (WORKS)
 *
 * BACKEND GAP — BOOKMARK IS NON-FUNCTIONAL on the current backend:
 *   POST /api/v1/me/bookmarks returns 200 but the bookmark is never persisted
 *   (bookmarks/status stays false and /me/bookshelf stays empty), and
 *   DELETE /api/v1/me/bookmarks returns 500 INTERNAL_ERROR.
 * The contract is kept here for Phase 2, but no bookmark UI is exposed.
 */
import { apiRequest } from "@/api/client";
import type {
  BookmarkStatus,
  CommentItem,
  CreateCommentPayload,
  LikeCount,
  LikeStatus,
} from "./interactions.types";

export const interactionsApi = {
  // ---- Likes (works) ----
  like: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, {
      method: "POST",
    }),

  unlike: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, {
      method: "DELETE",
    }),

  getLikeStatus: (objectType: string, objectId: string): Promise<LikeStatus> =>
    apiRequest<LikeStatus>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/status`,
    ),

  getLikeCount: (objectType: string, objectId: string): Promise<LikeCount> =>
    apiRequest<LikeCount>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}/count`,
    ),

  // ---- Comments (works; listing requires auth) ----
  getComments: (objectType: string, objectId: string): Promise<CommentItem[]> =>
    apiRequest<CommentItem[]>(
      `/api/v1/comments/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
    ),

  createComment: (payload: CreateCommentPayload): Promise<CommentItem> =>
    apiRequest<CommentItem>("/api/v1/comments", { method: "POST", body: payload }),

  // ---- Bookmarks (NON-FUNCTIONAL on current backend — see header note) ----
  addBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "POST", body: { objectType, objectId } }),

  removeBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "DELETE", body: { objectType, objectId } }),

  getBookmarkStatus: (objectType: string, objectId: string): Promise<BookmarkStatus> =>
    apiRequest<BookmarkStatus>(
      `/api/v1/bookmarks/status?objectType=${encodeURIComponent(objectType)}&objectId=${encodeURIComponent(objectId)}`,
    ),
};
