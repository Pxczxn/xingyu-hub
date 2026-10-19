import { ApiError } from "@/api/client";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import type { SeriesStatus } from "@/api/series/series.types";

/**
 * Series status vocabulary.
 *
 * `ACTIVE` means "publicly listed", NOT "still serialising"; `ARCHIVED` means
 * "removed from the public catalogue", NOT "finished". The Chinese labels must
 * never imply a completion state the backend does not have.
 */
export function seriesStatusLabel(status: SeriesStatus): string {
  return status === "ARCHIVED" ? "已归档" : "公开中";
}

export function seriesStatusDescription(status: SeriesStatus): string {
  return status === "ARCHIVED"
    ? "不再出现在系列广场，公开页面暂时无法访问；订阅和阅读记录会保留，重新设为公开后恢复。"
    : "会出现在系列广场，读者可以访问系列页面并订阅。";
}

export function apiErrorDetail(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

export function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.problem.status === 404 || error.problem.code === "NOT_FOUND")
  );
}

export function isConflictError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.problem.status === 409 && error.problem.code === "CONFLICT"
  );
}

export function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function articleDisplayTitle(title: string | null | undefined): string {
  const trimmed = title?.trim();
  return trimmed ? trimmed : "无标题文章";
}

export type ArticleDisplayTone = "published" | "pending" | "draft" | "blocked" | "unavailable";

export type ArticleDisplayState = {
  label: string;
  tone: ArticleDisplayTone;
  hint: string | null;
};

/**
 * Real chapter availability, derived from the owner list row.
 *
 * The backend allows ANY article the creator owns to be bound into a series —
 * including drafts and pieces under review. That is a useful pre-arrangement
 * flow, but "in the series" is not "readable": the public reader resolves the
 * article through `ArticleAccessService` and shows "章节正文暂不可读" until a
 * published revision exists. This maps the editorial + moderation dimensions to
 * what the creator needs to know, and never labels a draft "公开".
 *
 * `undefined` means the article is absent from `GET /me/articles`, which filters
 * out trashed articles — so an existing chapter can legitimately lose its row.
 */
export function articleDisplayState(article: MyArticleSummary | undefined): ArticleDisplayState {
  if (!article) {
    return {
      label: "文章不可用",
      tone: "unavailable",
      hint: "可能已移入回收站或已被删除，读者无法阅读；建议从系列移除。",
    };
  }
  const editorial = (article.status ?? "").trim().toUpperCase();
  const moderation = (article.moderationStatus ?? "NORMAL").trim().toUpperCase();
  const lifecycle = (article.lifecycleStatus ?? "ACTIVE").trim().toUpperCase();

  if (lifecycle === "TRASHED") {
    return {
      label: "回收站",
      tone: "blocked",
      hint: "文章在回收站中，读者无法阅读。",
    };
  }
  if (moderation === "HIDDEN") {
    return {
      label: "已隐藏",
      tone: "blocked",
      hint: "受治理限制，读者无法阅读。",
    };
  }
  if (moderation === "FROZEN") {
    return {
      label: "已冻结",
      tone: "blocked",
      hint: "受治理限制，阅读权限以文章实际访问结果为准。",
    };
  }
  if (editorial === "PUBLISHED") {
    return {
      label: "已发布",
      tone: "published",
      hint: null,
    };
  }
  if (editorial === "IN_REVIEW") {
    return {
      label: "审核中",
      tone: "pending",
      hint: "审核期间读者无法阅读；通过后仍受文章可见性限制。",
    };
  }
  if (editorial === "DRAFT") {
    return {
      label: "草稿",
      tone: "draft",
      hint: "尚未公开，读者暂时无法阅读。",
    };
  }
  return {
    label: editorial || "状态未知",

    tone: "draft",
    hint: "无法确认读者是否可读。",
  };
}
