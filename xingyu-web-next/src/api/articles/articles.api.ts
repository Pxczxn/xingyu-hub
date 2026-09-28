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
  ArticleLifecycleStatus,
  ArticleRevision,
  ArticleSubmission,
  MyArticleSummary,
  TrashItem,
} from "./articles.types";

const LIFECYCLE_VALUES: ArticleLifecycleStatus[] = ["DRAFT", "IN_REVIEW", "PUBLISHED"];

export function normalizeLifecycleStatus(value: string | null | undefined): ArticleLifecycleStatus {
  const upper = (value ?? "").toUpperCase();
  return (LIFECYCLE_VALUES as string[]).includes(upper)
    ? (upper as ArticleLifecycleStatus)
    : "DRAFT";
}

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

  /**
   * Submits the draft for review — the ONLY creator-facing lifecycle action.
   * Returns the submission id, NOT a slug or an article identifier.
   * Backend rejects with 409 when the article is already under review.
   */
  submitForReview: (articleId: string): Promise<ArticleSubmission> =>
    apiRequest<ArticleSubmission>(
      `/api/v1/me/articles/${encodeURIComponent(articleId)}/submit`,
      { method: "POST" },
    ),

  listMine: (): Promise<MyArticleSummary[]> => apiRequest<MyArticleSummary[]>("/api/v1/me/articles"),

  /**
   * Resolves one article's editorial status.
   *
   * The draft DTO (`WorkingDraftView`) deliberately does NOT carry status, so the
   * owner list is the only contract source for it. This is a single-item status
   * lookup, not a Studio content-list feature. Callers must treat a failure as
   * "unknown" and fall back to DRAFT rather than blocking the editor.
   */
  getMyArticleStatus: async (articleId: string): Promise<ArticleLifecycleStatus | null> => {
    const list = await articlesApi.listMine();
    const found = list.find((article) => article.id === articleId);
    return found ? normalizeLifecycleStatus(found.status) : null;
  },

  /**
   * Version history for one of my articles (Phase 2L).
   *
   * ⚠️ FORMAL revisions only — see the note on `ArticleRevision` in
   * articles.types.ts. A never-published draft legitimately returns `[]`.
   * `requireOwnedArticle` runs first, so a non-owner or unknown id is 404.
   */
  listRevisions: (articleId: string): Promise<ArticleRevision[]> =>
    apiRequest<ArticleRevision[]>(
      `/api/v1/me/articles/${encodeURIComponent(articleId)}/revisions`,
    ),

  /**
   * Restores a formal revision INTO the working draft (Phase 2L).
   *
   * This does not create a new article or a new revision — it overwrites the
   * draft's title/summary/cover/body/visibility and bumps `lockVersion`.
   *
   * Backend rejects with **409 CONFLICT 「文章当前不可恢复版本」** unless
   * `canEditDraft(article)`: ACTIVE lifecycle AND NORMAL moderation AND NOT
   * IN_REVIEW. So a published-but-ACTIVE article CAN be restored (this is the
   * normal "roll back my published piece" flow), while a piece sitting in the
   * review queue cannot. The UI hides the control outside that window rather
   * than rendering a button that always 409s.
   */
  restoreRevision: (articleId: string, revisionId: string): Promise<ArticleDraft> =>
    apiRequest<ArticleDraft>(
      `/api/v1/me/articles/${encodeURIComponent(articleId)}/revisions/${encodeURIComponent(revisionId)}/restore`,
      { method: "POST" },
    ),

  /*
   * Trash (Phase 3G). Three endpoints, all verified against CommunityArticleController
   * / TrashService:
   *   POST /api/v1/me/articles/{articleId}/trash    -> move to trash
   *   POST /api/v1/me/articles/{articleId}/restore  -> 204, restore from trash
   *   GET  /api/v1/me/trash                         -> List<TrashItemView>
   *
   * ⚠️ Trashing is NOT deleting, and restoring is NOT idempotent-safe to guess at:
   * `restoreArticle` throws 404 NOT_FOUND 「文章不在回收站」 when the row is absent,
   * so the UI must only offer restore on rows it actually listed.
   *
   * ⚠️ `trashArticle` refuses with 409 CONFLICT when the article is already
   * trashed, and ALSO when it is under review (「审核中的文章不可移入回收站」).
   * The UI hides the control for in-review pieces rather than rendering a button
   * that always 409s.
   */
  trash: (articleId: string): Promise<TrashItem> =>
    apiRequest<TrashItem>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/trash`, {
      method: "POST",
    }),

  /** 204 No Content on success; 404 when the article is not in the trash. */
  restoreFromTrash: (articleId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/articles/${encodeURIComponent(articleId)}/restore`, {
      method: "POST",
    }),

  /**
   * The owner's trash. ⚠️ HETEROGENEOUS rows — see the TrashItem type. Not
   * article-only, so callers must branch on `objectType`.
   */
  listTrash: (): Promise<TrashItem[]> => apiRequest<TrashItem[]>("/api/v1/me/trash"),
};
