/*
 * Article domain types.
 * Shape verified against the live backend GET /api/v1/articles/{id} (2026-09-21).
 */

export type ArticleDetail = {
  id: string;
  title: string;
  summary: string | null;
  coverUrl?: string | null;
  bodyMode?: string;
  body: string;
  slug: string | null;
  visibility: string;
  spaceSlug: string;
  ownerUsername: string;
  ownerAvatar?: string | null;
  ownerDisplayName?: string | null;
  publishedAt: string | null;
  owner: boolean;
  categorySlug?: string | null;
  topicSlugs?: string[];
};

/*
 * Author workspace (draft) types — Phase 1C-2.
 *
 * `ArticleDraft` mirrors the backend `WorkingDraftView` DTO field for field.
 * Verified by reading the backend source AND by a live probe against the running
 * backend (create / get / save / re-get) on 2026-09-21 — no invented fields.
 *
 * Notably ABSENT from this DTO: editorial status / lifecycle / moderation. The
 * backend exposes those on GET /api/v1/me/articles (list) only, so the editor
 * cannot learn from the draft endpoint whether the article is DRAFT, IN_REVIEW
 * or PUBLISHED. The editor therefore never branches on status.
 */
export type ArticleDraft = {
  articleId: string;
  title: string | null;
  summary: string | null;
  coverUrl: string | null;
  bodyMode: string | null;
  body: string | null;
  slug: string | null;
  visibility: string;
  categoryId: string | null;
  topicIds: string[];
  lockVersion: number;
  updatedAt: string;
  scheduledPublishAt: string | null;
};

/** Verified enum from top.pxczxn.xingyu.common.contract.access.Visibility. */
export type ArticleVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

/**
 * The exact PUT /api/v1/me/articles/{id}/draft body this round sends.
 *
 * Only fields this round actually edits are included. The backend applies patch
 * semantics (`body.containsKey(...)`), so omitted keys are left untouched —
 * coverUrl / categoryId / slug / scheduledPublishAt are deliberately omitted so
 * an existing value is preserved rather than wiped.
 */
export type ArticleDraftSavePayload = {
  title: string;
  summary: string;
  body: string;
  bodyMode: "MARKDOWN" | "RICH_TEXT";
  visibility: ArticleVisibility;
  topicIds: string[];
  /** Optimistic-lock token from the last load/save. Backend sets expected + 1. */
  lockVersion: number;
};
