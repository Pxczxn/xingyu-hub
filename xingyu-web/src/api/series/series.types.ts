/*
 * Series contract.
 *
 * Creator (Phase 2F live probe 2026-09-25):
 *   GET  /api/v1/me/series
 *   POST /api/v1/me/series
 *   GET  /api/v1/me/series/{id}
 *   PUT  /api/v1/me/series/{id}
 *   POST|DELETE /api/v1/me/series/{id}/subscribe
 *   POST /api/v1/me/reading-progress
 *
 * Public (Phase 2G live probe 2026-09-27):
 *   GET  /api/v1/series?limit=N               -> PublicSeriesSummary[]
 *   GET  /api/v1/series/{seriesId}            -> PublicSeriesDetail
 *   GET  /api/v1/series/{username}/{slug}     -> PublicSeriesDetail
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
