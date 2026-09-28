/*
 * Recommendation feedback types (Phase 3F).
 *
 * DTO: `RecommendationFeedbackView(String id, String body, Instant createdAt)`
 * — mirror the server record exactly. No user field, no rating, no target.
 */

export type RecommendationFeedback = {
  id: string;
  body: string;
  /** Server `Instant`; serialized as an ISO string. */
  createdAt: string;
};

/** Matches the server's own `@RequestParam(defaultValue = "20")`. */
export const RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT = 20;

/**
 * The service clamps with `Math.min(Math.max(limit, 1), 50)`, so 50 is a hard
 * server ceiling. Asking for more is silently reduced — state the real number
 * in the UI rather than the number we requested.
 */
export const RECOMMENDATION_FEEDBACK_MAX_LIMIT = 50;

/** Mirrors `RecommendationFeedbackService.submit`'s own check. */
export const RECOMMENDATION_FEEDBACK_MAX_LENGTH = 2000;
