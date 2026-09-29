/*
 * Content list logic (Phase 3G) — pure, no React.
 *
 * Why this module exists at all: the article editor already shipped
 * (`/studio/content/:articleId`, with `articleId === "new"` opening a blank
 * document), but NOTHING in V2 linked to it. A signed-in author could not start
 * an article without hand-typing the URL. This module backs the missing
 * content-management surface that closes that hole.
 *
 * Ported from the Legacy page `xingyu-web/app/studio/content/page.tsx`, with two
 * deliberate corrections:
 *
 *  1. **Unknown statuses are echoed verbatim, not coerced.** Legacy used
 *     `labels[state] || state`, which is fine, but it also filtered tabs with
 *     `["REVIEW", "REVIEWING"].includes(...)`. We keep the same tolerance for
 *     BOTH spellings (the backend has emitted each) while never inventing a
 *     Chinese label for a status we do not recognise.
 *
 *  2. **Trash is its own tab, not a status.** `GET /me/trash` is a separate
 *     endpoint returning `TrashItem` rows, so the trash tab cannot be derived
 *     from the owner list — it needs its own fetch. Modelling it as a status
 *     filter would silently show an empty list.
 */
import type { MyArticleSummary, TrashItem } from "@/api/articles/articles.types";

/** Tabs on the content-management page. `trash` is fed by a different endpoint. */
export type ContentTab = "all" | "published" | "drafts" | "reviewing" | "returned" | "trash";

export const CONTENT_TABS: ReadonlyArray<{ id: ContentTab; label: string }> = [
  { id: "all", label: "全部内容" },
  { id: "published", label: "已发布" },
  { id: "drafts", label: "草稿" },
  { id: "reviewing", label: "审核中" },
  { id: "returned", label: "被退回" },
  { id: "trash", label: "回收站" },
];

/**
 * Editorial status → Chinese label.
 *
 * Mirrors the Legacy map, plus TRASHED. Anything unrecognised is returned
 * as-is (never blank, never guessed) so a new backend status shows up loudly
 * instead of silently rendering an empty cell.
 */
const STATUS_LABELS: Record<string, string> = {
  PUBLISHED: "已发布",
  DRAFT: "草稿",
  REVIEW: "审核中",
  REVIEWING: "审核中",
  RETURNED: "被退回",
  TRASHED: "回收站",
};

export function articleStatusLabel(status: string | null | undefined): string {
  const value = (status ?? "").trim();
  if (!value) return "未知状态";
  // Case-insensitive lookup so a lowercase status does not filter into a tab as
  // one thing and render as another. Unknown values keep their ORIGINAL casing
  // (echoed verbatim) rather than being upper-cased into something unrecognisable.
  return STATUS_LABELS[value.toUpperCase()] ?? value;
}

/** The two spellings the backend has used for "in the review queue". */
export function isReviewing(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toUpperCase();
  return value === "REVIEW" || value === "REVIEWING";
}

/**
 * Rows that belong under a given tab.
 *
 * `trash` is NOT handled here on purpose — it is backed by `TrashItem` rows, a
 * different shape from a different endpoint. Returning `[]` makes that explicit
 * rather than letting a caller accidentally render the full list under the
 * trash tab.
 */
export function filterByTab(items: MyArticleSummary[], tab: ContentTab): MyArticleSummary[] {
  switch (tab) {
    case "all":
      return items;
    case "published":
      return items.filter((item) => (item.status ?? "").toUpperCase() === "PUBLISHED");
    case "drafts":
      return items.filter((item) => (item.status ?? "").toUpperCase() === "DRAFT");
    case "reviewing":
      return items.filter((item) => isReviewing(item.status));
    case "returned":
      return items.filter((item) => (item.status ?? "").toUpperCase() === "RETURNED");
    case "trash":
      return [];
  }
}

export type ContentCounters = {
  published: number;
  draft: number;
  review: number;
  returned: number;
};

/** Per-status counts for the overview panel. Counts the WHOLE list, not the tab. */
export function countByStatus(items: MyArticleSummary[]): ContentCounters {
  return {
    published: items.filter((item) => (item.status ?? "").toUpperCase() === "PUBLISHED").length,
    draft: items.filter((item) => (item.status ?? "").toUpperCase() === "DRAFT").length,
    review: items.filter((item) => isReviewing(item.status)).length,
    returned: items.filter((item) => (item.status ?? "").toUpperCase() === "RETURNED").length,
  };
}

/**
 * An article can be moved to the trash only when it is NOT in the review queue.
 *
 * `TrashService.trashArticle` throws 409 「审核中的文章不可移入回收站」 for those,
 * so the UI must not offer the action. Published and draft pieces are both fine.
 */
export function canTrash(article: MyArticleSummary): boolean {
  return !isReviewing(article.status);
}

/**
 * Trash rows that this page can act on.
 *
 * The trash endpoint is heterogeneous (`objectType` is not always "ARTICLE") and
 * only article rows are restorable through `POST /me/articles/{id}/restore`.
 * Non-article rows are surfaced as read-only so they are not silently hidden.
 */
export function splitTrash(items: TrashItem[]): { articles: TrashItem[]; others: TrashItem[] } {
  const articles: TrashItem[] = [];
  const others: TrashItem[] = [];
  for (const item of items) {
    if ((item.objectType ?? "").toUpperCase() === "ARTICLE") articles.push(item);
    else others.push(item);
  }
  return { articles, others };
}

/** Display title with an explicit fallback — a shell draft legitimately has null. */
export function trashItemTitle(item: TrashItem): string {
  const trimmed = item.title?.trim();
  return trimmed ? trimmed : "无标题文章";
}

export function articleListTitle(article: MyArticleSummary): string {
  const trimmed = article.title?.trim();
  return trimmed ? trimmed : "无标题文章";
}

/** Stable, human-readable timestamp. Returns the raw value if it cannot be parsed. */
export function formatArticleTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}
