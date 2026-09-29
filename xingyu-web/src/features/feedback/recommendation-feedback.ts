import {
  RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT,
  RECOMMENDATION_FEEDBACK_MAX_LENGTH,
  RECOMMENDATION_FEEDBACK_MAX_LIMIT,
} from "@/api/recommendation-feedback/recommendation-feedback.types";
import type { RecommendationFeedback } from "@/api/recommendation-feedback/recommendation-feedback.types";

/*
 * Pure logic for /feedback/recommendations (推荐反馈) — Phase 3F.
 *
 * All rules mirror `RecommendationFeedbackService`. Kept DOM-free so they are
 * testable in isolation.
 */

export type SubmitCheck =
  { ok: true; body: string } | { ok: false; reason: "empty" | "too_long"; message: string };

/**
 * Validate before submitting.
 *
 * Mirrors the server exactly: trim, reject blank, cap at 2000. Doing it locally
 * means the user sees an inline message instead of a round-trip 400. The server
 * check stays authoritative — this is a courtesy, not a substitute.
 */
export function checkFeedbackBody(raw: string): SubmitCheck {
  const body = (raw ?? "").trim();
  if (!body) return { ok: false, reason: "empty", message: "请输入反馈内容" };
  if (body.length > RECOMMENDATION_FEEDBACK_MAX_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `反馈内容不能超过 ${RECOMMENDATION_FEEDBACK_MAX_LENGTH} 字`,
    };
  }
  return { ok: true, body };
}

/** Remaining characters, floored at 0 (never a negative count). */
export function remainingChars(raw: string): number {
  return Math.max(0, RECOMMENDATION_FEEDBACK_MAX_LENGTH - (raw ?? "").length);
}

/**
 * Prepend a just-submitted entry, de-duplicated by id.
 *
 * The POST response contains the stored row, so there is no need to refetch —
 * but a genuine retry could return the SAME row (the client cannot know), so
 * de-duping by id keeps the list honest instead of showing it twice. The list is
 * bounded to the server's own window so a long session cannot grow it past what
 * a refresh would have returned.
 */
export function prependFeedback(
  current: RecommendationFeedback[],
  entry: RecommendationFeedback,
  limit: number = RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT,
): RecommendationFeedback[] {
  const cap = clampLimit(limit);
  const withoutDupe = current.filter((item) => item.id !== entry.id);
  return [entry, ...withoutDupe].slice(0, cap);
}

/** Mirror of the server's `Math.min(Math.max(limit, 1), 50)`. */
export function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), RECOMMENDATION_FEEDBACK_MAX_LIMIT);
}

/**
 * Is this row identical to the one we just submitted?
 *
 * Used only for the "已提交" confirmation: it must not claim the newest row is
 * the user's if the list was loaded from a different fetch. Comparing ids is
 * exact and avoids the trap of comparing body text (two identical complaints are
 * legitimate and would false-positive).
 */
export function isJustSubmitted(
  entry: RecommendationFeedback | null,
  rows: RecommendationFeedback[],
): boolean {
  if (!entry) return false;
  return rows.some((row) => row.id === entry.id);
}

/** Format an entry's timestamp for display; falls back to the raw value. */
export function formatFeedbackTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

/**
 * The honest scope sentence for this page.
 *
 * This endpoint takes NO target and NO rating — it is free text about the
 * RECOMMENDER as a whole. Without saying so, a user arriving from an article
 * will assume they are rating that article. Exported so the copy lives in one
 * place and is asserted by a test rather than drifting.
 */
export const FEEDBACK_SCOPE_NOTE =
  "这是对整个推荐系统的整体反馈，不是针对某一篇文章。提交后无法修改或删除，请直接写清楚你的想法。";
