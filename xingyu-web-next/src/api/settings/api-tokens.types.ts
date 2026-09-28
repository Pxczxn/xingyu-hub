/*
 * API Token domain types (Phase 2A-2b).
 *
 * Shape verified against the live backend 2026-09-23 (Legacy + Controller +
 * DTO/Service + live HTTP probe).
 *
 *   GET  /api/v1/me/api-tokens        -> ApiTokenSummary[]  (bare array, 200)
 *   POST /api/v1/me/api-tokens        -> ApiTokenCreated    (200)
 *   DELETE /api/v1/me/api-tokens/{id} -> 204 (idempotent)
 *
 * ⚠️ The secret model is genuinely one-time and enforced server-side:
 * `CommunityApiTokenService.create` stores ONLY `sha256(rawToken)` plus a
 * 12-char display prefix. There is no endpoint that can return the secret
 * again (probed: GET /{id} -> 405, /{id}/token -> 404, /{id}/reveal -> 404).
 * So the frontend does not need to "pretend" — it must simply never hold on
 * to the value beyond the create-success state.
 */

/** One row of `GET /api/v1/me/api-tokens`. */
export type ApiTokenSummary = {
  id: string;
  name: string;
  /** Display-only prefix, first 12 chars of the secret, e.g. "xy_1a2b3c4d5". */
  tokenPrefix: string;
  /** Granted scopes, e.g. ["read:profile", "read:articles"]. */
  scopes: string[];
  /** "ACTIVE" | "REVOKED". The list does NOT filter revoked rows out. */
  status: string;
  /** ISO-8601 UTC instant, e.g. "2026-09-23T15:05:34Z"; null until first use. */
  lastUsedAt: string | null;
  /** ISO-8601 UTC instant. */
  createdAt: string;
};

/**
 * `POST /api/v1/me/api-tokens` response — **the only place the full secret
 * ever appears**, in any response, ever.
 *
 * `token` is 67 chars: `"xy_" + 64 hex` (32 random bytes).
 */
export type ApiTokenCreated = {
  id: string;
  name: string;
  /** The full secret. Never re-queryable. Never persist this. */
  token: string;
  scopes: string[];
};

/** Status values the backend writes. */
export const API_TOKEN_STATUS_ACTIVE = "ACTIVE";
export const API_TOKEN_STATUS_REVOKED = "REVOKED";

/**
 * Backend `name` column is `varchar(128)` and the service does NOT validate
 * length, so a 129-char name surfaces as a generic **500 INTERNAL_ERROR**
 * (probed). The form must therefore cap the input client-side.
 */
export const API_TOKEN_NAME_MAX_LENGTH = 128;
