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

/*
 * Lifecycle (Phase 1C-3).
 *
 * IMPORTANT: the backend has NO creator-facing publish endpoint. Verified by
 * reading CommunityArticleController + a live probe (POST/PUT
 * /api/v1/me/articles/{id}/publish -> 404). The only creator-facing lifecycle
 * action is `POST /api/v1/me/articles/{id}/submit`, which moves the article
 * DRAFT -> IN_REVIEW. Publication (IN_REVIEW -> PUBLISHED) happens only through
 * the ADMIN review decision (AdminReviewController -> PublicationService), and
 * the scheduled-publish task also merely calls submitForReview.
 *
 * So the real creator-side machine is:
 *   DRAFT --submit--> IN_REVIEW --[admin approval]--> PUBLISHED
 */

/** POST /api/v1/me/articles/{articleId}/submit response. */
export type ArticleSubmission = {
  submissionId: string;
};

/** Editorial status. Exposed on the OWNER LIST only — never on the draft DTO. */
export type ArticleLifecycleStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED";

/** Row shape of GET /api/v1/me/articles (owner list). Only the fields used here. */
export type MyArticleSummary = {
  id: string;
  status: string;
  lifecycleStatus?: string;
  moderationStatus?: string;
  title: string | null;
  categoryId: string | null;
  updatedAt: string;
};

/*
 * Trash (Phase 3G) — mirrors backend `TrashItemView` field for field:
 *   objectType, objectId, title, trashedAt
 *
 * ⚠️ The trash list is HETEROGENEOUS: `objectType` is not always "ARTICLE".
 * `TrashService.listForOwner` reads a shared `trash_item` table that other
 * object kinds can write to, so the UI must filter/branch on `objectType`
 * rather than assuming every row is an article. The row's restore endpoint is
 * article-specific (`POST /me/articles/{id}/restore`), so a non-article row has
 * no working restore action here.
 *
 * ⚠️ `title` is nullable in the DB — a trashed shell may have `null`.
 */
export type TrashItem = {
  objectType: string;
  objectId: string;
  title: string | null;
  trashedAt: string;
};

/*
 * Version history (Phase 2L) — mirrors backend `ArticleRevisionView`.
 *
 * ⚠️ read `listRevisions` in ArticleService before trusting the name: it queries
 * `formalRevisionMapper.listByArticleId`, i.e. FORMAL revisions only. A formal
 * revision row is written when the article is published, so a draft that was
 * merely saved (never published) has an EMPTY history. The UI must therefore
 * treat "no versions" as the normal state for a never-published article rather
 * than as an error or a loading failure.
 *
 * Field-for-field against the DTO:
 *   id, revisionNumber (backend coerces null -> 0), title, summary,
 *   visibility, frozenAt
 *
 * ⚠️ `title` / `summary` are declared `String` in Java and are NOT annotated
 * nullable, so they are *probably* non-null — but the DB column is nullable and
 * the DTO passes it straight through. Treat `title` as possibly-null and fall
 * back, rather than rendering an empty heading.
 */
export type ArticleRevision = {
  id: string;
  revisionNumber: number;
  title: string | null;
  summary: string | null;
  visibility: string;
  /** Instant (ISO-8601 string) — when this revision was frozen. */
  frozenAt: string | null;
};

/*
 * `restoreRevision` returns the SAME shape as a draft save (`WorkingDraftView`),
 * because it mutates the working draft in place rather than creating anything.
 *
 * Side effects the UI must account for (verified in ArticleService):
 *  - overwrites title/summary/coverUrl/bodyMode/body/slug/visibility of the draft;
 *  - **increments lockVersion** — so any in-flight editor holding the old
 *    lockVersion will be rejected by the optimistic lock on its next save.
 */
