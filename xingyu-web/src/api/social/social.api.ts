import { apiRequest } from "@/api/client";
import { toFollowUsers, type FollowPage, type FollowUser } from "./social.types";

/*
 * Follow-graph reads. Writes (follow/unfollow) deliberately stay in the user
 * domain (usersApi.followUser / unfollowUser) — do NOT add a second wrapper here.
 *
 * Endpoints and their verified shapes are documented in social.types.ts.
 */
export const socialApi = {
  /** Signed-in user's own following list. Returns a PageResult -> unwrapped to an array. */
  listMyFollowing: async (limit = 20): Promise<FollowUser[]> =>
    toFollowUsers(
      await apiRequest<FollowPage>(`/api/v1/me/following?limit=${encodeURIComponent(limit)}`),
    ),

  /** Signed-in user's own followers. */
  listMyFollowers: async (limit = 20): Promise<FollowUser[]> =>
    toFollowUsers(
      await apiRequest<FollowPage>(`/api/v1/me/followers?limit=${encodeURIComponent(limit)}`),
    ),

  /** Another user's following list. 404 when the user does not exist. */
  listUserFollowing: async (username: string, limit = 50): Promise<FollowUser[]> =>
    toFollowUsers(
      await apiRequest<FollowPage>(
        `/api/v1/users/${encodeURIComponent(username)}/following?limit=${encodeURIComponent(limit)}`,
      ),
    ),

  /** Another user's followers list. 404 when the user does not exist. */
  listUserFollowers: async (username: string, limit = 50): Promise<FollowUser[]> =>
    toFollowUsers(
      await apiRequest<FollowPage>(
        `/api/v1/users/${encodeURIComponent(username)}/followers?limit=${encodeURIComponent(limit)}`,
      ),
    ),
};
