/*
 * Recommendation feedback (Phase 3F).
 *
 * Endpoints (both session-scoped, both probed 2026-09-28 -> a CORRECT 401):
 *   GET  /api/v1/me/recommendation-feedback?limit=20  -> RecommendationFeedbackView[]  BARE ARRAY
 *   POST /api/v1/me/recommendation-feedback           -> RecommendationFeedbackView
 *
 * ── Contract facts, read from `RecommendationFeedbackService` ──────────────
 *
 * 1. IT IS A BARE ARRAY, NOT A PAGE — and `limit` is the only lever. The service
 *    does `Math.min(Math.max(limit, 1), 50)`, so the client-side cap is 50 and
 *    there is NO cursor. Do not build a "load more": there is nothing to follow.
 *    (Same shape as reading history — see `reading-history.api.ts`.)
 *
 * 2. THE REQUEST BODY IS `{ body }` AND NOTHING ELSE. `submit` reads a single
 *    field; there is no rating, no target content id, no category. So this is
 *    free-form feedback about the RECOMMENDER IN GENERAL — not a per-article
 *    "推荐不准" vote. The UI must say so, or users will think they are rating an
 *    article they just saw.
 *
 * 3. SERVER VALIDATION: blank (after trim) -> 400 `body: 反馈内容不能为空`;
 *    longer than 2000 -> 400 `body: 反馈内容不能超过 2000 字`. The client mirrors
 *    both so the user gets an inline message instead of a round-trip.
 *
 * 4. THE VIEW HAS NO USER FIELD: `record(id, body, createdAt)`. These are the
 *    caller's OWN entries (the service is `listByUserId(user.getId(), capped)`),
 *    so there is nothing to attribute and no "author" to display.
 *
 * 5. `RecommendationFeedbackView` IS NOT ANOTHER FEEDBACK TYPE. `submissions`
 *    has a reviewer-feedback field of its own with a totally different meaning
 *    (an editor's note on a submission). Do not merge them.
 */
import { apiRequest } from "@/api/client";
import { RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT } from "./recommendation-feedback.types";
import type { RecommendationFeedback } from "./recommendation-feedback.types";

export const recommendationFeedbackApi = {
  /** The caller's own submissions, newest first (server sorts). */
  list: (
    limit: number = RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT,
  ): Promise<RecommendationFeedback[]> =>
    apiRequest<RecommendationFeedback[]>(
      `/api/v1/me/recommendation-feedback?limit=${encodeURIComponent(String(limit))}`,
    ),

  /** Submits one entry and returns the stored row (with its server-minted id). */
  submit: (body: string): Promise<RecommendationFeedback> =>
    apiRequest<RecommendationFeedback>("/api/v1/me/recommendation-feedback", {
      method: "POST",
      body: { body },
    }),
};
