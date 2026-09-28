/*
 * Public announcements API (Phase 2B).
 *
 * VERIFIED live 2026-09-24 (isolated test DB):
 *   GET /api/v1/announcements?limit=   bare JSON array (default limit 20)
 *   GET /api/v1/announcements/{id}     bare JSON object; ARCHIVED/missing -> 404 NOT_FOUND
 * Guest-accessible. No envelope. No category / pin / cursor.
 */
import { apiRequest } from "@/api/client";
import type { Announcement } from "./announcements.types";

export const announcementsApi = {
  list: (limit = 20): Promise<Announcement[]> =>
    apiRequest<Announcement[]>(`/api/v1/announcements?limit=${encodeURIComponent(String(limit))}`),

  getById: (id: string): Promise<Announcement> =>
    apiRequest<Announcement>(`/api/v1/announcements/${encodeURIComponent(id)}`),
};
