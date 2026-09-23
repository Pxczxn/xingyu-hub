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
 * Added in Phase 2A-1 (re-verified against the live backend 2026-09-22):
 *   PATCH  /api/v1/me/profile                -> ProfileDetail   (200 / 409 / 400)
 *   PATCH  /api/v1/me/profile/privacy        -> ProfileDetail   (200 / 400)
 *
 * Added in Phase 2A-2a (verified against the live backend 2026-09-23):
 *   GET    /api/v1/me/blocks                 -> BlockedUser[]    (200)
 *   POST   /api/v1/me/blocks/{username}      -> 204 (idempotent)
 *   DELETE /api/v1/me/blocks/{username}      -> 204 (idempotent)
 *
 * Unlike Topic follow (404), User follow genuinely works.
 */
import { apiRequest } from "@/api/client";
import type {
  BlockedUser,
  ProfileDetail,
  SpaceWorks,
  UpdateMyPrivacyPayload,
  UpdateMyProfilePayload,
} from "./users.types";

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

  /*
   * Phase 2A-1: profile writes live in this domain because the endpoints are
   * literally `/me/profile*`. Do NOT add a second `/me/profile` wrapper elsewhere.
   * Patch semantics: send only the keys that changed.
   */
  updateMyProfile: (payload: UpdateMyProfilePayload): Promise<ProfileDetail> =>
    apiRequest<ProfileDetail>("/api/v1/me/profile", { method: "PATCH", body: payload }),

  /** Separate endpoint from updateMyProfile — it ignores lockVersion entirely. */
  updateMyPrivacy: (payload: UpdateMyPrivacyPayload): Promise<ProfileDetail> =>
    apiRequest<ProfileDetail>("/api/v1/me/profile/privacy", { method: "PATCH", body: payload }),

  /*
   * Phase 2A-2a: user blocking. These are the ONLY wrappers for the three
   * `/me/blocks` endpoints — do not add a second one in another domain module.
   *
   * Verified against the live backend 2026-09-23 (UserBlockService):
   *   - the path variable is a username
   *   - blocking is idempotent: blocking an already-blocked user is a silent 204
   *   - unblocking a non-blocked user is a silent 204
   *   - blocking yourself is a 400 ("username: 不能屏蔽自己") — the UI never
   *     offers that control (see ProfileBlockControl), the guard is just honest
   *   - a missing target is a 404
   */
  listBlockedUsers: (): Promise<BlockedUser[]> =>
    apiRequest<BlockedUser[]>("/api/v1/me/blocks"),

  blockUser: (username: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/blocks/${encodeURIComponent(username)}`, { method: "POST" }),

  unblockUser: (username: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/blocks/${encodeURIComponent(username)}`, { method: "DELETE" }),
};
