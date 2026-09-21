/*
 * Article domain API.
 *
 * Public read:
 *   GET /api/v1/articles/{articleId}
 *
 * Author workspace (drafts) — Phase 1C-2. Endpoints verified against the real
 * backend controller (CommunityArticleController) and a live HTTP probe:
 *   POST /api/v1/me/articles                     -> create a draft shell
 *   GET  /api/v1/me/articles/{articleId}         -> read my draft
 *   PUT  /api/v1/me/articles/{articleId}/draft   -> save my draft
 *
 * The draft endpoints live under the same `/me/articles` resource family as the
 * public read, so they stay in ONE module — no second `studio-article-api`, one
 * implementation source per endpoint. Topics (used by editor settings) already
 * have their own domain module: src/api/topics/topics.api.ts.
 */
import { apiRequest } from "@/api/client";
import type {
  ArticleDetail,
  ArticleDraft,
  ArticleDraftSavePayload,
} from "./articles.types";

export const articlesApi = {
  getArticle: (articleId: string): Promise<ArticleDetail> =>
    apiRequest<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}`),

  /** Creates an empty draft shell (title/body null, bodyMode MARKDOWN, PRIVATE, lockVersion 0). */
  createDraft: (): Promise<ArticleDraft> =>
    apiRequest<ArticleDraft>("/api/v1/me/articles", { method: "POST" }),

  /** Returns 404 for both "does not exist" and "not mine" — the backend does not distinguish. */
  getDraft: (articleId: string): Promise<ArticleDraft> =>
    apiRequest<ArticleDraft>(`/api/v1/me/articles/${encodeURIComponent(articleId)}`),

  /**
   * Saves the draft. Requires the lockVersion from the last load/save; a stale
   * value makes the backend answer 409 CONFLICT ("草稿已被他人更新，请刷新后重试").
   */
  saveDraft: (articleId: string, payload: ArticleDraftSavePayload): Promise<ArticleDraft> =>
    apiRequest<ArticleDraft>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/draft`, {
      method: "PUT",
      body: payload,
    }),
};
