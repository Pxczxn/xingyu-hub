import type { ArticleSummary } from "@/lib/community-api";

export type StudioArticleFilter = "all" | "draft" | "review" | "published" | "hidden" | "scheduled";

export type StudioStatusTone = "draft" | "review" | "published" | "hidden" | "scheduled" | "returned";

export type StudioDisplayStatus = {
  label: string;
  tone: StudioStatusTone;
};

const REVIEW_STATUSES = new Set(["IN_REVIEW", "REVIEW", "REVIEWING"]);

export function resolveArticleDisplayStatus(
  article: ArticleSummary,
  scheduledIds?: ReadonlySet<string>
): StudioDisplayStatus {
  if (article.moderationStatus === "HIDDEN") {
    return { label: "已隐藏", tone: "hidden" };
  }
  if (article.status === "RETURNED") {
    return { label: "被退回", tone: "returned" };
  }
  if (REVIEW_STATUSES.has(article.status)) {
    return { label: "审核中", tone: "review" };
  }
  if (article.status === "PUBLISHED") {
    return { label: "已发布", tone: "published" };
  }
  if (scheduledIds?.has(article.id)) {
    return { label: "定时发布", tone: "scheduled" };
  }
  return { label: "草稿", tone: "draft" };
}

export function matchesStudioFilter(
  article: ArticleSummary,
  filter: StudioArticleFilter,
  scheduledIds?: ReadonlySet<string>
): boolean {
  const { tone } = resolveArticleDisplayStatus(article, scheduledIds);
  if (filter === "all") return true;
  if (filter === "draft") return tone === "draft" || tone === "returned";
  if (filter === "review") return tone === "review";
  if (filter === "published") return tone === "published";
  if (filter === "hidden") return tone === "hidden";
  if (filter === "scheduled") return tone === "scheduled";
  return true;
}

export const STUDIO_RECENT_TABS: Array<{ key: StudioArticleFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "draft", label: "草稿" },
  { key: "review", label: "审核中" },
  { key: "published", label: "已发布" },
  { key: "hidden", label: "已隐藏" },
  { key: "scheduled", label: "定时发布" },
];
