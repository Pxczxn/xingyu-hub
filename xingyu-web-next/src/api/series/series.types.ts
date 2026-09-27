/*
 * Creator Series contract (Phase 2F live probe 2026-09-25).
 *
 * GET  /api/v1/me/series
 * POST /api/v1/me/series
 * GET  /api/v1/me/series/{id}
 * PUT  /api/v1/me/series/{id}
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
