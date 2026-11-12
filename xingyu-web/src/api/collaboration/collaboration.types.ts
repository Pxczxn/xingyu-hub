/*
 * Collaboration invite domain types.
 *
 * createInvite writes collaboration_invite.
 * resolveInvite is a public read.
 * acceptInvite writes collaboration_member (owner_id = inviter, member_id = accepter,
 * role = EDITOR) and is idempotent for the same pair. Self-accept is 409.
 * The member can edit that author's drafts. Submit and trash stay with the author.
 *
 * inviteUrl is a relative path. Prefix it with the origin before sharing.
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
export type CollaborationParticipant = {
  userId: string;
  username: string;
  displayName: string;
  role: "EDITOR";
  joinedAt: string;
};

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
