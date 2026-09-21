/*
 * User / profile domain API (extracted from the Legacy community API module — NOT the whole file).
 *
 * VERIFIED against the live backend 2026-09-21:
 *   GET    /api/v1/users/{username}          -> ProfileDetail (includes username)  (WORKS)
 *   GET    /api/v1/users/{username}/works    -> SpaceWorks                          (WORKS)
 *   POST   /api/v1/users/{username}/follow   -> 204                                 (WORKS)
 *   DELETE /api/v1/users/{username}/follow   -> 204                                 (WORKS)
 *   GET    /api/v1/me/profile                -> ProfileDetail (includes username)  (WORKS)
 *
 * Unlike Topic follow (404), User follow genuinely works.
 */
import { apiRequest } from "@/api/client";
import type { ProfileDetail, SpaceWorks } from "./users.types";

export const usersApi = {
  getProfile: (username: string): Promise<ProfileDetail> =>
    apiRequest<ProfileDetail>(`/api/v1/users/${encodeURIComponent(username)}`),

  getUserWorks: (username: string, category?: string): Promise<SpaceWorks> =>
    apiRequest<SpaceWorks>(
      `/api/v1/users/${encodeURIComponent(username)}/works${category ? `?category=${encodeURIComponent(category)}` : ""}`,
    ),

  followUser: (username: string): Promise<void> =>
    apiRequest<void>(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "POST" }),

  unfollowUser: (username: string): Promise<void> =>
    apiRequest<void>(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: "DELETE" }),

  /** Current user's own canonical profile — the only reliable source of our username. */
  getMyProfile: (): Promise<ProfileDetail> => apiRequest<ProfileDetail>("/api/v1/me/profile"),
};
