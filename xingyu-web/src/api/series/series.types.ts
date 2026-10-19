/*
 * Series contract.
 *
 * Creator (Phase 2F live probe 2026-09-25):
 *   GET  /api/v1/me/series
 *   POST /api/v1/me/series
 *   GET  /api/v1/me/series/{id}
 *   PUT  /api/v1/me/series/{id}
 *   POST|DELETE /api/v1/me/series/{id}/subscribe
 *   GET  /api/v1/me/series/{id}/reading-progress -> SeriesReadingProgress
 *   POST /api/v1/me/reading-progress
 *
 * Public (Phase 2G live probe 2026-09-27):
 *   GET  /api/v1/series?limit=N               -> PublicSeriesSummary[]      (legacy, no cursor)
 *   GET  /api/v1/series/search?q=&limit=&cursor= -> PublicSeriesPage        (plaza, 2026-10-18)
 *   GET  /api/v1/series/{seriesId}            -> PublicSeriesDetail
 *   GET  /api/v1/series/{username}/{slug}     -> PublicSeriesDetail
 *
 * `/series/search` is the plaza contract: keyset cursor over
 * (updated_at DESC, id DESC), `q` matches title / description / author over the
 * WHOLE public collection, and `total` is the real match count. `nextCursor`
 * null is the only evidence that the end is reached. The legacy bare-array
 * endpoint is kept for callers that only need a bounded overview.
 *
 * Both public detail routes return the same PublicSeriesDetail shape and 404
 * (ProblemDetails code NOT_FOUND) for a missing or non-ACTIVE series.
 *
 * Binding is the same PUT with chapterArticleIds. There is no Chapter REST.
 */

export type SeriesStatus = "ACTIVE" | "ARCHIVED";

export type SeriesSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: SeriesStatus;
  chapterCount: number;
  updatedAt: string;
};

export type SeriesChapterRelation = {
  id: string;
  articleId: string;
  title: string | null;
  position: number;
};

export type SeriesDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: SeriesStatus;
  lockVersion: number;
  chapters: SeriesChapterRelation[];
  updatedAt: string;
};

export type CreateSeriesPayload = {
  title: string;
  slug: string;
  description?: string;
};

export type UpdateSeriesPayload = {
  title?: string;
  description?: string;
  status?: SeriesStatus;
  chapterArticleIds?: string[];
  lockVersion: number;
};

export type PublicIdentity = {
  username: string;
  displayName: string | null;
  avatar: string | null;
};

export type PublicSeriesSummary = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  chapterCount: number;
  author: PublicIdentity;
};

/**
 * One page of the public series catalogue (`GET /series/search`).
 *
 * `nextCursor` null means there is no next page — that is the only signal a
 * caller may use to conclude the list ended. `total` is the server's real
 * COUNT for the current keyword, not the number of items in this page; it is
 * optional so a page still renders if an older payload omits it.
 */
export type PublicSeriesPage = {
  items: PublicSeriesSummary[];
  nextCursor?: string | null;
  total?: number;
};

export type PublicSeriesDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  chapters: SeriesChapterRelation[];
  author: PublicIdentity;
  /**
   * viewer-scoped 订阅状态：登录用户 true/false，游客 null（未知≠未订阅）。
   * Series Subscription Closure，2026-10-10。
   */
  hasSubscribed?: boolean | null;
};

/**
 * The signed-in reader's own position in ONE series (`GET /me/series/{id}/reading-progress`).
 *
 * Progress is measured in CHAPTERS, never in a percentage: `series_reader_state`
 * stores the last-read article and a timestamp, and nothing records how far into
 * that chapter the reader got. `chapterIndex` is 1-based and only present when
 * the recorded chapter is still part of the series AND still readable — when it
 * is absent, fall back to "start reading" rather than assuming chapter 1 or 0.
 *
 * `readingHistoryEnabled: false` means the reader turned history off: there is
 * no progress to resume, and this is a choice, not a read failure.
 *
 * The fields are optional in the transport shape because the server omits nulls;
 * `chapterArticleId == null` is the "nothing to resume" signal.
 */
export type SeriesReadingProgress = {
  readingHistoryEnabled: boolean;
  chapterArticleId?: string | null;
  chapterIndex?: number | null;
  chapterCount: number;
  lastReadAt?: string | null;
};
