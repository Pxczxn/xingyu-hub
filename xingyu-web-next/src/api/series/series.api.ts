import { apiRequest } from "@/api/client";
import type { CreateSeriesPayload, SeriesDetail, SeriesSummary, UpdateSeriesPayload } from "./series.types";

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
};
