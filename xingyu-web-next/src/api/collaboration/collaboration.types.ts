/*
 * Collaboration invite domain types (Phase 2M).
 *
 * ⚠️ READ THIS BEFORE TRUSTING ANY LABEL ON THIS FEATURE.
 *
 * Verified against `CollaborationService` + `CollaborationInviteView` +
 * the `collaboration_invite` table (sql/V024) on 2026-09-28:
 *
 *   createInvite  -> WRITES a row (the invite itself). Real.
 *   resolveInvite -> READ-ONLY lookup. Real. Public (no auth).
 *   acceptInvite  -> **WRITES NOTHING.** It validates the token, refuses
 *                    self-acceptance, and returns the inviter's profile. That
 *                    is the entire implementation.
 *
 * There is therefore NO collaboration relationship anywhere in the backend:
 *   - the only insert in the whole service is the invite row itself;
 *   - the table has no `accepted_by` / `accepted_at` column;
 *   - no `collaborator` / `space_member` table exists;
 *   - a repo-wide grep finds no reader of "who accepted".
 *
 * Consequence, and the reason this file leads with a warning: after accepting,
 * NEITHER party gains any access or permission. The invite link is, today, a
 * message with a receipt — not a grant.
 *
 * The UI must say this out loud rather than implying a working collaboration
 * handshake. Legacy did not: it printed 「已接受协作邀请」 and a button to "view the
 * collaboration space", which reads as "you are now a collaborator". That is the
 * same class of misstatement as the version-history auto-save lie (see Phase 2L).
 */

/** `POST /api/v1/me/collaboration-invites` response (`CollaborationInviteView`). */
export type CollaborationInvite = {
  id: string;
  token: string;
  /**
   * ⚠️ A RELATIVE path, e.g. `/studio/collaboration/accept?token=...`.
   * Legacy prefixed it with `window.location.origin` before showing/copying it.
   * Keep that behaviour — the value alone is not a usable link.
   */
  inviteUrl: string;
  note: string | null;
  expiresAt: string;
};

/**
 * `GET /api/v1/collaboration/invites/resolve?token=...`.
 *
 * ⚠️ This is a LOOSE map, not a fixed shape. The backend builds it with
 * `Map.of(...)`, which THROWS on a null value — so `inviterUsername` /
 * `inviterDisplayName` can be absent rather than null, and the invalid branch
 * returns the single key `{valid: false}` and nothing else. Every field except
 * `valid` must therefore be treated as optional.
 *
 * Also note the note field: the backend maps a null note to `""`, so an absent
 * note arrives as an empty string, not as null/undefined.
 */
export type CollaborationInviteResolve = {
  valid: boolean;
  inviterUsername?: string;
  inviterDisplayName?: string | null;
  note?: string;
  expiresAt?: string;
};

/** `POST /api/v1/collaboration/invites/accept` response. */
export type CollaborationAcceptResult = {
  accepted: boolean;
  inviterUsername?: string;
  inviterDisplayName?: string | null;
  note?: string;
};

/**
 * Invite lifetime as the backend sets it (`now.plus(7, DAYS)` in createInvite).
 * Used for copy only — never for client-side expiry checks, because the server
 * is the authority and a client clock can be wrong.
 */
export const INVITE_VALID_DAYS = 7;
