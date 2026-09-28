/*
 * API Token domain API (Phase 2A-2b).
 *
 * VERIFIED against the live backend 2026-09-23:
 *   GET    /api/v1/me/api-tokens        -> ApiTokenSummary[] (200, bare array)
 *   POST   /api/v1/me/api-tokens        -> ApiTokenCreated   (200)
 *   DELETE /api/v1/me/api-tokens/{id}   -> 204
 *
 * Endpoint facts that shape the UI:
 *   - `limit` works (default 20); `cursor` is silently ignored -> no pagination.
 *   - revoked rows stay in the list (`status: "REVOKED"`), so the UI shows them
 *     with a badge instead of pretending they vanished.
 *   - there is no rename (PATCH/PUT -> 405) and no expiry (expiry keys are
 *     silently dropped), so neither is offered.
 *   - `name` is required + trimmed; blank -> 400 VALIDATION_FAILED.
 *   - revoke of an unknown id or another user's token -> 404 (never 403).
 *
 * 🔒 `create` MUST NOT go through the response-token auto-persist path:
 * `apiRequest` treats a body `token` field as the **login** token and writes it
 * to `localStorage["xingyu-satoken"]`. The create response's `token` is the API
 * secret, so persisting it would overwrite the session (and the next 401 would
 * log the user out). `persistToken: false` opts this one call out. Probed +
 * covered by a regression test.
 */
import { apiRequest } from "@/api/client";
import type { ApiTokenCreated, ApiTokenSummary } from "./api-tokens.types";

const BASE_PATH = "/api/v1/me/api-tokens";

export const apiTokensApi = {
  /**
   * Tokens for the current user, newest first, revoked rows included.
   * `limit` is the only supported knob; the backend has no cursor.
   */
  list: (limit = 20): Promise<ApiTokenSummary[]> =>
    apiRequest<ApiTokenSummary[]>(`${BASE_PATH}?limit=${limit}`),

  /**
   * Creates a token and returns the one-and-only copy of its secret.
   * `scopes` is deliberately not sent: the backend then defaults to
   * ["read:profile", "read:articles"], which is the full set it supports.
   */
  create: (name: string): Promise<ApiTokenCreated> =>
    apiRequest<ApiTokenCreated>(BASE_PATH, {
      method: "POST",
      body: { name },
      persistToken: false,
    }),

  /** Idempotent: revoking an already-revoked token still returns 204. */
  revoke: (tokenId: string): Promise<void> =>
    apiRequest<void>(`${BASE_PATH}/${encodeURIComponent(tokenId)}`, { method: "DELETE" }),
};
