/*
 * Reading history (Phase 3B).
 *
 * ⚠️ NAME WARNING — read this before "fixing" anything.
 *
 * The endpoint is `GET /api/v1/me/reading-history`. It EXISTS and requires a
 * session (probed 2026-09-28: 401 AUTH_REQUIRED).
 *
 * A DIFFERENT path, `GET /api/v1/me/history`, does NOT exist — it 500s (no
 * handler, no matching guard). The two strings look alike but are not the same
 * route, and an earlier doc revision (`LEGACY-DELTA` §三·补3) wrongly concluded
 * from the 500 that "reading history is absent from the backend". It is not.
 * Legacy's own `getHistory()` calls THIS path (`community-api.ts:940`).
 *
 * Contract (read from `CommunityMeController:201` + `ReadingService.readingHistory`):
 *
 *   GET /me/reading-history?limit=20&cursor=  ->  PageResultView<ContentCardView>
 *
 * The service ignores `cursor` entirely — it returns `continueReading(user, limit)`
 * with `nextCursor: null`. So the response is a *PageResultView shell* over a
 * single bounded read: the ONLY way to get more is a larger `limit`. Do not build
 * a cursor-driven "load more"; there is no cursor to follow.
 *
 * `readingHistoryEnabled` (a user setting) short-circuits it to an EMPTY list —
 * not an error. An empty result therefore means "off, or nothing read", and the
 * UI must not assert which.
 *
 * `POST /me/reading-progress` RECORDS progress and is deliberately NOT wrapped
 * here: reading progress is written by the reading surfaces themselves, not by a
 * history-list page. Adding a writer to this module would invite a page to
 * fabricate history.
 */
import { apiRequest } from "@/api/client";
import type { PageResult } from "@/api/common.types";

/**
 * Element shape: `ContentCardView`.
 *
 * Note this is NOT the same as `ContentSummary` used by `/me/home`: the server
 * declares `objectType`, which the reading surfaces need in order to resolve a
 * link. Keeping them distinct avoids reusing `ContentSummary` and silently
 * losing `objectType`.
 */
export type ReadingHistoryItem = {
  id: string;
  objectType?: string;
  title?: string;
  summary?: string;
  cover?: string;
  authorName?: string;
  updatedAt?: string;
};

/** Default matches the server's own `@RequestParam(defaultValue = "20")`. */
export const READING_HISTORY_DEFAULT_LIMIT = 20;

/** The server caps at 100 via `ReadingService.continueReading` (limit<=0 -> 10). */
export const READING_HISTORY_MAX_LIMIT = 100;

export const readingHistoryApi = {
  /**
   * One bounded read. `limit` is the only lever — there is no usable cursor.
   */
  list: (limit: number = READING_HISTORY_DEFAULT_LIMIT): Promise<PageResult<ReadingHistoryItem>> =>
    apiRequest<PageResult<ReadingHistoryItem>>(
      `/api/v1/me/reading-history?limit=${encodeURIComponent(String(limit))}`,
    ),
};
