/*
 * Client-settings domain API (Phase 2A-2c).
 *
 * `settings_json` is a free-form blob on `community_profile` and the avatar
 * lives inside it — NOT in a profile column. So the avatar is written through
 * this side channel, never through PATCH /me/profile.
 *
 * Verified live on 2026-09-23:
 *   GET /api/v1/me/client-settings            -> {} initially
 *   PUT /api/v1/me/client-settings {avatar:url} -> 200, returns the merged map
 *   PUT /api/v1/me/client-settings {avatar:null} -> 200, returns {} (key removed)
 *   GET /api/v1/me/profile afterwards -> `avatar` reflects the new value / null
 *
 * Merge semantics (`ClientSettingsService.updateSettings`): keys present in the
 * body are overwritten, `null` REMOVES the key, everything else is untouched.
 * So writing the avatar can never clobber the other settings keys — unlike
 * PATCH /me/profile, which silently ignores nulls.
 *
 * The endpoint does no validation at all: a non-string value is stored as-is.
 * Callers must send a string URL or `null`.
 */
import { apiRequest } from "@/api/client";

/** The settings blob is an untyped merge target; only `avatar` is consumed here. */
export type ClientSettings = Record<string, unknown>;

export const clientSettingsApi = {
  /**
   * Set or clear the profile avatar.
   *
   * Pass `null` to remove the key, which is the backend's real "reset to the
   * default avatar" — verified to leave every other settings key intact.
   *
   * Returns the merged settings map so the caller can adopt the server's view
   * instead of assuming the write landed.
   */
  updateAvatar: (avatar: string | null): Promise<ClientSettings> =>
    apiRequest<ClientSettings>("/api/v1/me/client-settings", {
      method: "PUT",
      body: { avatar },
    }),
};
