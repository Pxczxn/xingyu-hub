/*
 * Home domain API (extracted from the Legacy community API module — NOT the whole file).
 * Endpoints:
 *   GET /api/v1/home            (guest home)
 *   GET /api/v1/me/home         (authenticated home)
 *   GET /api/v1/announcements   (community announcements)
 */
import { apiRequest } from "@/api/client";
import { toContentSummary, type AnnouncementSummary } from "@/api/common.types";
import type { GuestHomeRaw, GuestHomeView, MeHomeView } from "./home.types";

/** Legacy maps the raw search hits into ContentSummary before render. */
function mapGuestHome(raw: GuestHomeRaw): GuestHomeView {
  return {
    unreadNotifications: raw.unreadNotifications,
    continueReading: raw.continueReading.map(toContentSummary),
    followingUpdates: raw.followingUpdates.map(toContentSummary),
    discoveries: raw.discoveries.map(toContentSummary),
  };
}

export const homeApi = {
  getGuestHome: async (): Promise<GuestHomeView> => mapGuestHome(await apiRequest<GuestHomeRaw>("/api/v1/home")),

  getMyHome: (): Promise<MeHomeView> => apiRequest<MeHomeView>("/api/v1/me/home"),

  getAnnouncements: (limit = 3): Promise<AnnouncementSummary[]> =>
    apiRequest<AnnouncementSummary[]>(`/api/v1/announcements?limit=${encodeURIComponent(String(limit))}`),
};
