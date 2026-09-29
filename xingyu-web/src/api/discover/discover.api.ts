/*
 * Discover + Search API (extracted from the Legacy community API module — NOT the whole file).
 * Endpoints:
 *   GET /api/v1/discover            (cursor page)
 *   GET /api/v1/discover/nav        (section copy; its domain/sort tabs are NOT
 *                                    honored by /api/v1/discover on the current
 *                                    backend — verified during Phase 1A acceptance)
 *   GET /api/v1/search              (keyword search)
 *
 * NOTE: /api/v1/explore/feed is intentionally NOT used — it returns
 * 500 INTERNAL_ERROR on the current backend (verified 2026-09-20).
 */
import { apiRequest } from "@/api/client";
import { toContentSummary, toPage, type ContentSummary, type CursorInput, type PageResult, type SearchHit } from "@/api/common.types";
import type { ExploreNav, SearchParams } from "./discover.types";

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const discoverApi = {
  getDiscover: (input: CursorInput = {}): Promise<PageResult<ContentSummary>> =>
    apiRequest<PageResult<ContentSummary>>(`/api/v1/discover${qs({ cursor: input.cursor, limit: input.limit })}`),

  getDiscoverNav: (): Promise<ExploreNav> => apiRequest<ExploreNav>("/api/v1/discover/nav"),

  /** Backend returns SearchHit[]; the UI consumes PageResult<ContentSummary>. */
  search: async ({ q, type, sort = "hot", limit = 20 }: SearchParams): Promise<PageResult<ContentSummary>> => {
    const hits = await apiRequest<SearchHit[]>(
      `/api/v1/search${qs({ q, type: type === "ALL" ? undefined : type, sort, limit })}`,
    );
    return toPage(hits.map(toContentSummary), hits.length);
  },
};
