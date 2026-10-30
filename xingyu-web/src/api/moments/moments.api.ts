/*
 * Moments — public feed/detail + owner mutations (Phase 2D).
 *
 * VERIFIED live 2026-09-24:
 *   write paths are /api/v1/moments/* (not /me/moments/{id})
 *   GET /me/moments is only for conservative owner-control detection
 *   GET /users/{username}/moments is the public profile list (2026-10-30);
 *     it is keyset paged → { items, nextCursor }, not a bare array
 */
import { apiRequest } from "@/api/client";
import type { PageResult } from "@/api/common.types";
import type { InsightsView, MomentBodyPayload, MomentView } from "./moments.types";
import { FEED_LIMIT, OWNER_LIST_LIMIT } from "./moments.types";

export const momentsApi = {
  list: (limit: number = FEED_LIMIT): Promise<MomentView[]> =>
    apiRequest<MomentView[]>(`/api/v1/moments?limit=${limit}`),

  create: (payload: MomentBodyPayload): Promise<MomentView> =>
    apiRequest<MomentView>("/api/v1/moments", { method: "POST", body: payload }),

  getById: (id: string): Promise<MomentView> =>
    apiRequest<MomentView>(`/api/v1/moments/${encodeURIComponent(id)}`),

  update: (id: string, payload: MomentBodyPayload): Promise<MomentView> =>
    apiRequest<MomentView>(`/api/v1/moments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    }),

  trash: (id: string): Promise<MomentView> =>
    apiRequest<MomentView>(`/api/v1/moments/${encodeURIComponent(id)}/trash`, { method: "POST" }),

  listMine: (limit: number = OWNER_LIST_LIMIT): Promise<MomentView[]> =>
    apiRequest<MomentView[]>(`/api/v1/me/moments?limit=${limit}`),

  /**
   * A profile's public PUBLISHED moments, newest first — one keyset page.
   *
   * Paged since 2026-10-30. The profile renders a server-side `momentCount` above
   * this list, so a fixed window would contradict the count as soon as an author
   * passed it. Pass the previous page's `nextCursor` back as `cursor`;
   * `nextCursor: null` is the only evidence the list ended.
   */
  listByUsername: (
    username: string,
    options: { limit?: number; cursor?: string | null } = {},
  ): Promise<PageResult<MomentView>> => {
    const params = new URLSearchParams({ limit: String(options.limit ?? FEED_LIMIT) });
    if (options.cursor) params.set("cursor", options.cursor);
    return apiRequest<PageResult<MomentView>>(
      `/api/v1/users/${encodeURIComponent(username)}/moments?${params.toString()}`,
    );
  },
};

/*
 * `GET /api/v1/me/insights` lives in this module because it is the counters
 * panel of the same owner surface (/me/moments), not because it is a moment
 * endpoint — it counts articles, comments and likes too. It is deliberately NOT
 * merged into `momentsApi`: a caller wanting only the insights should not
 * import a moments client to get them.
 */
export const meInsightsApi = {
  get: (): Promise<InsightsView> => apiRequest<InsightsView>("/api/v1/me/insights"),
};
