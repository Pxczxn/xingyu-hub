import type { MyArticleSummary } from "@/api/articles/articles.types";
import { normalizeLifecycleStatus } from "@/api/articles/articles.api";
import type { SeriesSummary } from "@/api/series/series.types";
import type { MomentView } from "@/api/moments/moments.types";
import type { SubmissionObjectType } from "./events.types";

/*
 * Which of the caller's own content can be submitted to an event (Phase 2I-4).
 *
 * WHY THIS FILTER EXISTS, and why it is not cosmetic.
 *
 * `CommunityEventService.submit` checks the object against `search_document`:
 *
 *     if (searchDocumentMapper.findByObject(objectType, objectId) == null)
 *         throw new ContractException(ErrorCode.NOT_FOUND, "投稿内容不存在");
 *
 * Only PUBLISHED content is indexed there. A DRAFT article is not, so submitting
 * one fails with 404 「投稿内容不存在」 — which reads like the server lost the
 * article and is actually the rule working. The submit page must therefore not
 * OFFER anything that cannot succeed, or the user is invited to walk into an
 * error whose message actively misleads them.
 *
 * This is a UI guard, not a security boundary: the server is still the
 * authority and its error is still surfaced verbatim if it disagrees.
 *
 * What counts as submittable, per type:
 *   - ARTICLE: lifecycle PUBLISHED. DRAFT and IN_REVIEW are both excluded —
 *     IN_REVIEW is especially tempting to include and is still wrong, because
 *     the article is not published until an admin approves it.
 *   - SERIES: status ACTIVE. ARCHIVED is excluded.
 *   - MOMENT: everything. A moment has no draft state — `POST /moments`
 *     publishes immediately — so it is listed as-is.
 *
 * The note that a series' PUBLISHED-ness is not checked here is deliberate: the
 * series row carries no chapter-level publication state, and the backend's index
 * entry for a SERIES is keyed on the series itself. Guessing at chapter state
 * would be inventing a rule the server does not have.
 */

export type SubmissionOption = {
  objectType: SubmissionObjectType;
  objectId: string;
  title: string;
};

/** The types offered by the picker, in display order. */
export const SUBMISSION_OBJECT_TYPES: SubmissionObjectType[] = ["ARTICLE", "SERIES", "MOMENT"];

/** A published article's title, with an honest fallback for an untitled one. */
function articleTitle(article: MyArticleSummary): string {
  const title = article.title?.trim();
  return title || "未命名文章";
}

/** Only PUBLISHED articles can be submitted — see the header. */
export function submittableArticles(articles: MyArticleSummary[]): SubmissionOption[] {
  return articles
    .filter((article) => normalizeLifecycleStatus(article.status) === "PUBLISHED")
    .map((article) => ({
      objectType: "ARTICLE" as const,
      objectId: article.id,
      title: articleTitle(article),
    }));
}

/** Only ACTIVE series can be submitted. */
export function submittableSeries(series: SeriesSummary[]): SubmissionOption[] {
  return series
    .filter((item) => item.status === "ACTIVE")
    .map((item) => ({
      objectType: "SERIES" as const,
      objectId: item.id,
      title: item.title?.trim() || "未命名系列",
    }));
}

/**
 * Every moment is submittable, but the id is a poor title — a moment has no
 * title field, so the body is used and truncated rather than invented.
 */
export function submittableMoments(moments: MomentView[]): SubmissionOption[] {
  return moments.map((moment) => ({
    objectType: "MOMENT" as const,
    objectId: moment.id,
    title: momentTitle(moment),
  }));
}

/** First line of a moment's body, truncated — moments carry no title. */
export function momentTitle(moment: MomentView): string {
  const firstLine = moment.body?.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "无正文动态";
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}
