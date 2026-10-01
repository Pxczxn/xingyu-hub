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
 * ⚠️ WHY NO BOOKMARK UI IS EXPOSED (re-verified against the backend on 2026-09-29).
 *
 * An earlier revision of this note blamed the bookmark endpoints themselves — that was
 * wrong. The endpoints are fine: `POST/DELETE /me/bookmarks` and `GET /bookmarks/status`
 * all behave, and `CollectionService`'s read/write logic is sound.
 *
 * The blocker is upstream. `CollectionService.validateObject` requires the object to already
 * exist in `search_document`, and NOTHING in the backend ever writes that table — the only
 * INSERT in the whole repo is in `scripts/seed_sample_content.py`. Publishing an article
 * leaves `article.status = PUBLISHED` but creates no index row (verified on a real DB), so
 * every bookmark attempt answers 404 「内容不存在或不可收藏」.
 *
 * The contract is therefore kept here and no bookmark UI is exposed — not because the
 * endpoint is broken, but because there is nothing bookmarkable to point it at. The product
 * doc §20.3 specifies the fix: publish / hide / delete / restore must drive index updates.
 * That consumer is not written yet.
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

  createComment: (payload: CreateCommentPayload): Promise<CommentItem> =>
    apiRequest<CommentItem>("/api/v1/comments", { method: "POST", body: payload }),

  // ---- Bookmarks (kept for a future UI: every object currently 404s — see header note) ----
  addBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "POST", body: { objectType, objectId } }),

  removeBookmark: (objectType: string, objectId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/bookmarks", { method: "DELETE", body: { objectType, objectId } }),

  getBookmarkStatus: (objectType: string, objectId: string): Promise<BookmarkStatus> =>
    apiRequest<BookmarkStatus>(
      `/api/v1/bookmarks/status?objectType=${encodeURIComponent(objectType)}&objectId=${encodeURIComponent(objectId)}`,
    ),
};
