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
 *   GET  /api/v1/series?limit=N               -> SeriesSummary[]
 *   GET  /api/v1/series/{seriesId}            -> SeriesDetail
 *   GET  /api/v1/series/{username}/{slug}     -> SeriesDetail
 *
 * Both public detail routes return the same SeriesDetail shape and 404
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

/*
 * Public read shapes (live probe 2026-09-27).
 *
 * Note the asymmetry with the creator views above: the public detail carries
 * `lockVersion` and `chapters`, but no chapterCount — the public list carries
 * `chapterCount` and no `chapters`. `GET /series/{id}` and
 * `GET /series/{username}/{slug}` both return `SeriesDetail`.
 */
export type PublicSeriesSummary = SeriesSummary;

export type PublicSeriesDetail = SeriesDetail;
