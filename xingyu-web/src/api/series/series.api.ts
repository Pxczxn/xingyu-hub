import { apiRequest } from "@/api/client";
import type {
  CreateSeriesPayload,
  PublicSeriesDetail,
  PublicSeriesPage,
  PublicSeriesSummary,
  SeriesDetail,
  SeriesReadingProgress,
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

  /**
   * The plaza's paged + searchable catalogue (2026-10-18).
   *
   * `q` is matched by the SERVER across the whole public collection (title,
   * description, author), so a keyword can find a series that is past the first
   * page. Paging is keyset: pass the previous page's `nextCursor` back as
   * `cursor`; a null/absent cursor starts from the first page.
   */
  searchPublic: (
    input: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<PublicSeriesPage> => {
    const params = new URLSearchParams();
    params.set("limit", String(input.limit ?? 20));
    const keyword = input.q?.trim();
    if (keyword) params.set("q", keyword);
    if (input.cursor) params.set("cursor", input.cursor);
    return apiRequest<PublicSeriesPage>(`/api/v1/series/search?${params.toString()}`);
  },

  getPublicById: (id: string): Promise<PublicSeriesDetail> =>
    apiRequest<PublicSeriesDetail>(`/api/v1/series/${encodeURIComponent(id)}`),

  /**
   * One profile's public ACTIVE series, newest-updated first (2026-10-30).
   *
   * Lives under the user resource because it is the profile's own surface: the
   * endpoint applies the same profile visibility gate as `GET /users/{username}`
   * (a PRIVATE profile 404s), then pages exactly like the plaza catalogue.
   */
  listByUsername: (
    username: string,
    options: { limit?: number; cursor?: string | null } = {},
  ): Promise<PublicSeriesPage> => {
    const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
    if (options.cursor) params.set("cursor", options.cursor);
    return apiRequest<PublicSeriesPage>(
      `/api/v1/users/${encodeURIComponent(username)}/series?${params.toString()}`,
    );
  },

  getPublicBySlug: (username: string, slug: string): Promise<PublicSeriesDetail> =>
    apiRequest<PublicSeriesDetail>(
      `/api/v1/series/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
    ),

  /* Reader actions. Both need a session; guests get 401. */

  /**
   * The signed-in reader's position in one series (Phase 3C).
   *
   * A dedicated single-series read instead of downloading `/me/reading-history`
   * and searching it client-side: the history endpoint is a bounded feed and
   * would turn a private, per-work question into "page through everything".
   */
  getReadingProgress: (seriesId: string): Promise<SeriesReadingProgress> =>
    apiRequest<SeriesReadingProgress>(
      `/api/v1/me/series/${encodeURIComponent(seriesId)}/reading-progress`,
    ),

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
