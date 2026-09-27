import { apiRequest } from "@/api/client";
import type {
  CreateSeriesPayload,
  PublicSeriesDetail,
  PublicSeriesSummary,
  SeriesDetail,
  SeriesSummary,
  UpdateSeriesPayload,
} from "./series.types";

export const seriesApi = {
  listMine: (): Promise<SeriesSummary[]> => apiRequest<SeriesSummary[]>("/api/v1/me/series"),

  create: (payload: CreateSeriesPayload): Promise<SeriesDetail> =>
    apiRequest<SeriesDetail>("/api/v1/me/series", { method: "POST", body: payload }),

  getMine: (id: string): Promise<SeriesDetail> =>
    apiRequest<SeriesDetail>(`/api/v1/me/series/${encodeURIComponent(id)}`),

  update: (id: string, payload: UpdateSeriesPayload): Promise<SeriesDetail> =>
    apiRequest<SeriesDetail>(`/api/v1/me/series/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: payload,
    }),

  /* Public reads (Phase 2G). Guest-reachable, no token required. */

  listPublic: (limit = 20): Promise<PublicSeriesSummary[]> =>
    apiRequest<PublicSeriesSummary[]>(`/api/v1/series?limit=${encodeURIComponent(limit)}`),

  getPublicById: (id: string): Promise<PublicSeriesDetail> =>
    apiRequest<PublicSeriesDetail>(`/api/v1/series/${encodeURIComponent(id)}`),

  getPublicBySlug: (username: string, slug: string): Promise<PublicSeriesDetail> =>
    apiRequest<PublicSeriesDetail>(
      `/api/v1/series/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
    ),

  /* Reader actions. Both need a session; guests get 401. */

  subscribe: (id: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/series/${encodeURIComponent(id)}/subscribe`, { method: "POST" }),

  unsubscribe: (id: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/series/${encodeURIComponent(id)}/subscribe`, { method: "DELETE" }),

  recordReadingProgress: (seriesId: string, articleId: string): Promise<void> =>
    apiRequest<void>("/api/v1/me/reading-progress", {
      method: "POST",
      body: { seriesId, articleId },
    }),
};
