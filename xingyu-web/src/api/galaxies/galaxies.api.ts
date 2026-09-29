import { apiRequest } from "@/api/client";
import type {
  GalaxyContent,
  GalaxyJoinRequest,
  GalaxyMember,
  GalaxySummary,
} from "./galaxies.types";

export const galaxiesApi = {
  /* Public reads. Guest-reachable, no token required. */
  list: (): Promise<GalaxySummary[]> => apiRequest<GalaxySummary[]>("/api/v1/galaxies"),

  getBySlug: (slug: string): Promise<GalaxySummary> =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}`),

  listMembers: (slug: string, limit = 50): Promise<GalaxyMember[]> =>
    apiRequest<GalaxyMember[]>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/members?limit=${encodeURIComponent(limit)}`,
    ),

  listContent: (slug: string, limit = 20): Promise<GalaxyContent[]> =>
    apiRequest<GalaxyContent[]>(
      `/api/v1/galaxies/${encodeURIComponent(slug)}/content?limit=${encodeURIComponent(limit)}`,
    ),

  /* Membership. All three need a session; guests get 401. */

  /**
   * The galaxies the caller has JOINED (Phase 3I: also the data behind
   * `/me/galaxies`). A bare `GalaxySummary[]` — the same shape as `list()`, so
   * the two are interchangeable downstream.
   */
  listMine: (): Promise<GalaxySummary[]> => apiRequest<GalaxySummary[]>("/api/v1/me/galaxies"),

  join: (slug: string): Promise<GalaxySummary> =>
    apiRequest<GalaxySummary>(`/api/v1/galaxies/${encodeURIComponent(slug)}/join`, {
      method: "POST",
    }),

  apply: (slug: string, message?: string): Promise<GalaxyJoinRequest> =>
    apiRequest<GalaxyJoinRequest>(`/api/v1/galaxies/${encodeURIComponent(slug)}/apply`, {
      method: "POST",
      body: message === undefined ? {} : { message },
    }),
};
