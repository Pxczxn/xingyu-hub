/*
 * Moments — public feed/detail + owner mutations (Phase 2D).
 *
 * VERIFIED live 2026-09-24:
 *   write paths are /api/v1/moments/* (not /me/moments/{id})
 *   GET /me/moments is only for conservative owner-control detection
 */
import { apiRequest } from "@/api/client";
import type { MomentBodyPayload, MomentView } from "./moments.types";
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
};
