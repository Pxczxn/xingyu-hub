/*
 * Session (account security) domain types.
 * Shape verified against the live backend 2026-09-22:
 *   GET /api/v1/me/sessions -> SessionSummary[]
 *
 * SessionView fields (backend DTO, all present):
 *   sessionId, deviceLabel, lastActiveAt, expiresAt, revoked, current
 *
 * NOTE: the endpoint returns EVERY session row for the user, including ones
 * already revoked (`revoked: true`). The UI filters those out — see sessions.api.
 */

export type SessionSummary = {
  sessionId: string;
  /** Backend substitutes "未知设备" when the stored label is empty. */
  deviceLabel: string;
  /** ISO-8601 instant, e.g. "2026-09-22T11:49:38Z". */
  lastActiveAt: string;
  expiresAt: string;
  revoked: boolean;
  /** True for the session that made this request (matched on the satoken header). */
  current: boolean;
};
