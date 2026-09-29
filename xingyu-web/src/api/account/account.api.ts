/*
 * Account security & data-sovereignty API (Phase 3H).
 *
 * These four capabilities were verified against the real backend controllers
 * (`CommunityMeController`, `CommunityAuthController`, `RecentAuthenticationService`).
 * All four are FULL self-service endpoints — none of them requires a human/ops
 * gate, which is worth stating because V2's own settings navigation previously
 * claimed the opposite (see the note in SettingsNav.tsx, corrected in this phase).
 *
 *   POST /api/v1/auth/re-authenticate             -> { recentAuthId, expiresAt }
 *   POST /api/v1/me/email/change                  -> { currentEmail, pendingEmail, mailPending }
 *   GET  /api/v1/me/data-export                   -> arbitrary JSON snapshot
 *   POST /api/v1/me/account/deletion-request      -> 204
 */
import { apiRequest } from "@/api/client";
import type {
  AccountDeletionResult,
  ChangeEmailResult,
  DataExportPayload,
  RecentAuthGrant,
} from "./account.types";

export const accountApi = {
  /**
   * Re-authenticate with the current password to mint a short-lived grant.
   *
   * `reAuthenticate` in RecentAuthenticationService inserts a row valid for
   * **15 minutes** and returns `{ recentAuthId, expiresAt }`. The grant is bound
   * to BOTH the user AND the session id, so it cannot be replayed from another
   * session and dies with the session.
   *
   * ⚠️ `persistToken: false` — the response has no session `token`, but the
   * client's default behaviour would still try to harvest one from a `token`
   * body field. Keeping the default here is fine (there is no such field), but
   * we set it explicitly so a future added field cannot silently clobber the
   * session token.
   */
  reAuthenticate: (password: string): Promise<RecentAuthGrant> =>
    apiRequest<RecentAuthGrant>("/api/v1/auth/re-authenticate", {
      method: "POST",
      body: { password },
      persistToken: false,
    }),

  /**
   * Request an email change. Requires a valid recent-auth grant in the
   * `X-Recent-Auth` header — without it the backend answers 403 AUTH_FORBIDDEN
   * 「请先完成身份再认证」 (RecentAuthenticationService:48-57).
   *
   * ⚠️ This does NOT change the email immediately. The backend issues a
   * verification token to the NEW address and returns `mailPending`. The change
   * only takes effect after that link is followed, so the UI must not claim the
   * email has changed. `mailPending: false` means the confirmation mail could
   * NOT be delivered — the current email stays valid and the caller must say so
   * rather than implying success.
   */
  changeEmail: (
    payload: { newEmail: string; password: string },
    recentAuthId?: string,
  ): Promise<ChangeEmailResult> =>
    apiRequest<ChangeEmailResult>("/api/v1/me/email/change", {
      method: "POST",
      body: payload,
      headers: recentAuthId ? { "X-Recent-Auth": recentAuthId } : undefined,
      persistToken: false,
    }),

  /**
   * A JSON snapshot of the caller's own data (`DataExportService.export`):
   * profile, articles, collections, comments, likes, bookshelf, readingHistory,
   * each capped at 200 rows.
   *
   * ⚠️ There is no server-side file/zip endpoint — the payload IS the export.
   * The UI downloads it client-side as a JSON blob.
   */
  getDataExport: (): Promise<DataExportPayload> =>
    apiRequest<DataExportPayload>("/api/v1/me/data-export", { persistToken: false }),

  /**
   * Request account deletion.
   *
   * ⚠️ Read `requestAccountDeletion` before describing this to a user: it does
   * NOT delete anything. It sets `user.status = "SUSPENDED"` and returns 204.
   * There is no cancellation endpoint, no confirmation email, and no scheduled
   * erasure job in the codebase. So the UI must say "deactivate" honestly
   * instead of promising irreversible deletion — and must warn that the caller
   * has no way back through the UI.
   */
  requestAccountDeletion: (): Promise<AccountDeletionResult> => apiRequestAccountDeletion(),
};

/**
 * Kept as a separate function so the 204 → `{ requested: true }` shaping has one
 * home. `apiRequest<void>` resolves to `undefined` on 204, which is awkward to
 * assert on and easy to mistake for "nothing happened".
 */
async function apiRequestAccountDeletion(): Promise<AccountDeletionResult> {
  await apiRequest<void>("/api/v1/me/account/deletion-request", {
    method: "POST",
    persistToken: false,
  });
  return { requested: true };
}
