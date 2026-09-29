/*
 * Session / account-security domain API (Phase 2A-1).
 *
 * VERIFIED against the live backend 2026-09-22 (Phase 2-0 §6.4.2):
 *   GET    /api/v1/me/sessions                  -> SessionSummary[]   (200)
 *   DELETE /api/v1/me/sessions/{sessionId}      -> 204 (then that token 401s)
 *   POST   /api/v1/me/sessions/revoke-others    -> 204 (keeps the current one)
 *
 * ⚠️ `revoke` accepts the CURRENT session id and will happily kill it (the
 * backend does not special-case it — verified: DELETE on own session -> 204,
 * after which the token returns 401). The UI must therefore never offer revoke
 * on the current row.
 *
 * `revoke-others` skips the caller's own token server-side, so it is safe to
 * invoke from the active session.
 *
 * `GET /me/sessions` requires the `satoken` header (the controller declares it
 * as a required @RequestHeader); api/client.ts injects it from storage.
 */
import { apiRequest } from "@/api/client";
import type { SessionSummary } from "./sessions.types";

export const sessionsApi = {
  /**
   * Active sessions only, current first, then most-recently-active.
   * The backend also returns already-revoked rows; they are filtered here so
   * every caller sees a list where every entry is still meaningful.
   */
  list: async (): Promise<SessionSummary[]> => {
    const all = await apiRequest<SessionSummary[]>("/api/v1/me/sessions");
    const active = (all ?? []).filter((session) => !session.revoked);
    return active.sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
    });
  },

  revoke: (sessionId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),

  /** Signs out every session except the caller's. */
  revokeOthers: (): Promise<void> =>
    apiRequest<void>("/api/v1/me/sessions/revoke-others", { method: "POST" }),
};
