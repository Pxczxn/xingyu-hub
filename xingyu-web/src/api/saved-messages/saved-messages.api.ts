import { apiRequest } from "@/api/client";
import {
  SAVED_MESSAGE_LIMIT,
  toSavedMessages,
  type SavedMessageView,
} from "./saved-messages.types";

/*
 * Saved messages — the bookmark store behind 「收藏的私信」 (Phase 3I).
 *
 * All three calls are scoped to the community session (`CommunityAuthContext`),
 * so a guest gets 401. The transport is deliberately thin: shape handling lives
 * in saved-messages.types.ts, and every call here is one request.
 *
 * The one trap this module exists to pin: `remove` takes a MESSAGE id, not the
 * bookmark row's `id`. See the types header §2.
 */
export const savedMessagesApi = {
  /**
   * The caller's bookmarks, newest first.
   *
   * BARE ARRAY. `limit` is clamped to 1..100 server-side; the endpoint default
   * is 50. Requesting more than 100 is silently capped, not an error.
   *
   * ⚠️ ALL-OR-NOTHING FAILURE MODE (backend limitation, verified 2026-09-28).
   * `SavedMessageService.listSaved` maps every row through `toView`, which
   * throws NOT_FOUND when the underlying message OR its conversation row is
   * gone — and messages are HARD-deleted (no `deleted` column on ChatMessage).
   * So deleting ONE bookmarked message turns the ENTIRE list into a 404: the
   * user cannot see any of their remaining bookmarks.
   *
   * There is no client-side fix — the endpoint never sends the surviving rows.
   * The only honest thing the UI can do is render the 404 as an ERROR rather
   * than as an empty list, so it never reads as 「你没有收藏」. Callers must not
   * swallow this into `[]`.
   */
  list: async (limit: number = SAVED_MESSAGE_LIMIT): Promise<SavedMessageView[]> =>
    toSavedMessages(
      await apiRequest<SavedMessageView[]>(
        `/api/v1/me/saved-messages?limit=${encodeURIComponent(String(limit))}`,
      ),
    ),

  /**
   * Bookmarks a message.
   *
   * Idempotent: saving an already-saved message returns the existing bookmark
   * rather than a 409, so a duplicate click is harmless.
   *
   * 404 (not 403) when the caller is not a member of the message's conversation
   * — and also when the message does not exist. The two are indistinguishable
   * on purpose; do not try to report them differently.
   */
  save: (messageId: string): Promise<SavedMessageView> =>
    apiRequest<SavedMessageView>("/api/v1/me/saved-messages", {
      method: "POST",
      body: { messageId },
    }),

  /**
   * Removes a bookmark. Takes the MESSAGE id — NOT the bookmark row's `id`.
   *
   * 404 when no bookmark exists for that message, so removing twice is an
   * error rather than a silent no-op. Callers should hide the control once the
   * row is gone rather than offering an idempotent-looking "un-save" twice.
   *
   * Resolves to void (204 No Content).
   */
  remove: (messageId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/saved-messages/${encodeURIComponent(messageId)}`, {
      method: "DELETE",
    }),
};
