/*
 * Account security & data-sovereignty types (Phase 3H).
 *
 * Shapes taken from the backend response bodies, not invented:
 *   RecentAuthenticationService.reAuthenticate -> Map.of("recentAuthId", .., "expiresAt", ..)
 *   CommunityAccountService.changeEmail        -> Map.of("currentEmail", .., "pendingEmail", .., "mailPending", ..)
 *   DataExportService.export                   -> LinkedHashMap with 8 keys
 */

/**
 * A short-lived re-authentication grant (15 minutes — `VALID_MINUTES` in
 * RecentAuthenticationService). Bound to the user AND the session.
 */
export type RecentAuthGrant = {
  recentAuthId: string;
  /** ISO-8601 instant. Backend always sends it; kept optional defensively. */
  expiresAt?: string;
};

export type ChangeEmailResult = {
  /** The address still in effect. */
  currentEmail: string;
  /** The address awaiting confirmation. NOT active until the link is followed. */
  pendingEmail: string;
  /**
   * `false` means the confirmation mail could not be delivered → the new email
   * will never activate. The UI must surface this as a problem, not a success.
   */
  mailPending: boolean;
};

/**
 * `POST /me/account/deletion-request` answers 204 with no body. We shape it into
 * an object so callers cannot confuse "no content" with "no response".
 */
export type AccountDeletionResult = {
  requested: true;
};

/**
 * The data export payload. `DataExportService.export` returns a
 * `Map<String, Object>` built in this key order:
 *   exportedAt, profile, articles, collections, comments, likes, bookshelf, readingHistory
 *
 * ⚠️ Deliberately typed as an open record: the server builds it as a plain map
 * with no DTO, so any strict interface would be an invention that could drift.
 * The UI treats it as opaque JSON and downloads it as-is — it must NOT try to
 * re-render each section, because the nested shapes are owned by other domains.
 */
export type DataExportPayload = {
  exportedAt?: string;
  [key: string]: unknown;
};

export const RECENT_AUTH_VALID_MINUTES = 15;
