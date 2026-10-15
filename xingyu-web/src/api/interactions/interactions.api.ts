/*
 * Interaction domain API (extracted from the Legacy community API module — NOT the whole file).
 *
 * VERIFIED against the live backend:
 *   Like      POST/DELETE /api/v1/likes/{objectType}/{objectId}   -> 204 (WORKS)
 *   LikeState GET /api/v1/likes/{ot}/{id}/status                  -> {liked}   (WORKS)
 *   LikeCount GET /api/v1/likes/{ot}/{id}/count                   -> {count}   (WORKS)
 *   Comments  GET  /api/v1/comments/{ot}/{id}                     -> CommentItem[] (auth required)
 *   Comments  POST /api/v1/comments                               -> CommentItem   (WORKS)
 *
 * BOOKMARKS ARE LIVE (re-verified 2026-10-10, P0-C).
 *
 * History note: a 2026-09-29 revision of this header (and an older note below
 * it) hid the bookmark UI because `CollectionService.validateObject` requires a
 * `search_document` row and nothing wrote that table — every bookmark answered
 * 404 「内容不存在或不可收藏」. That gap has since been closed: publishing emits
 * PUBLICATION_SUCCEEDED, SearchIndexEventHandler consumes it, and the index row
 * exists. The full lifecycle (add / remove / idempotent repeats / status
 * re-read / guest behavior / unindexable object 404) is pinned by
 * BookmarkLifecycleIntegrationTest, and the publish→index→bookmark happy path
 * by SearchIndexPipelineIntegrationTest. The bookmark UI is therefore exposed
 * again in ArticleInteractions.
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
    apiRequest<void>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      {
        method: "POST",
      },
    ),

  unlike: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>(
      `/api/v1/likes/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
      {
        method: "DELETE",
      },
    ),

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

  // Public preview returns at most three visible comments for a publicly readable article or series.
  getCommentPreview: (objectType: string, objectId: string): Promise<CommentItem[]> =>
    apiRequest<CommentItem[]>(
      `/api/v1/comments/preview/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`,
    ),

  createComment: (payload: CreateCommentPayload): Promise<CommentItem> =>
    apiRequest<CommentItem>("/api/v1/comments", { method: "POST", body: payload }),

  // ---- Bookmarks (live — see header note) ----
  addBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "POST", body: { objectType, objectId } }),

  removeBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "DELETE", body: { objectType, objectId } }),

  getBookmarkStatus: (objectType: string, objectId: string): Promise<BookmarkStatus> =>
    apiRequest<BookmarkStatus>(
      `/api/v1/bookmarks/status?objectType=${encodeURIComponent(objectType)}&objectId=${encodeURIComponent(objectId)}`,
    ),
};
