/*
 * Pure helpers for the collaboration invite pages (Phase 2M).
 *
 * ⚠️ The single most important thing here is `acceptanceBoundaryNote`. Read the
 * header of collaboration.types.ts for why: accepting an invite writes nothing
 * server-side, so the UI must not imply a permission change.
 */
import { INVITE_VALID_DAYS } from "@/api/collaboration/collaboration.types";
import type {
  CollaborationAcceptResult,
  CollaborationInviteResolve,
} from "@/api/collaboration/collaboration.types";

/** Longest note the backend column accepts (`note varchar(512)`). */
export const INVITE_NOTE_MAX_LENGTH = 512;

/**
 * The honest disclosure shown on the accept page.
 *
 * Kept as a single exported constant so the wording is asserted in one place and
 * cannot drift between the pending and accepted views. Changing the feature
 * without changing this string is the failure mode this guards against.
 */
export const ACCEPTANCE_BOUNDARY_NOTE =
  "接受邀请目前只会确认这条邀请，双方都不会因此获得任何协作权限。协作权限尚未实现。";

/**
 * Turns the backend's RELATIVE `inviteUrl` into something a user can share.
 *
 * Legacy did `${window.location.origin}${invite.inviteUrl}`. We keep that, but
 * guard the case where the path is already absolute so we never produce
 * "http://hosthttp://host/...".
 */
export function absoluteInviteUrl(inviteUrl: string, origin: string): string {
  const path = inviteUrl.trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = origin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Display name for the inviter, falling back through display name → username →
 * a neutral phrase.
 *
 * `resolveInvite` builds its map with `Map.of`, which throws on null, so either
 * name can be ABSENT. Never render "undefined" or an empty string here.
 */
export function inviterDisplayName(
  value: Pick<CollaborationInviteResolve, "inviterUsername" | "inviterDisplayName">,
): string {
  const display = value.inviterDisplayName?.trim();
  if (display) return display;
  const username = value.inviterUsername?.trim();
  if (username) return username;
  return "一位创作者";
}

/**
 * Explains an unusable invite.
 *
 * Returns null when the invite CAN be shown, so callers can write
 * `if (reason) showError(reason)`. `valid === false` is a normal 200 response,
 * not an error, so it must be routed through here rather than treated as a
 * network failure.
 */
export function inviteProblem(
  invite: CollaborationInviteResolve | null,
): string | null {
  if (!invite || !invite.valid) {
    return "这个邀请链接已失效或不存在。请向邀请你的人索取新的链接。";
  }
  return null;
}

/**
 * Formats the expiry for display, or null when absent/unparseable.
 *
 * The client never DECIDES expiry from this — the server does that. This is
 * display only, so a bad value degrades to "no timestamp" rather than a bogus
 * date.
 */
export function formatExpiry(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Copy for the create form's lifetime hint, derived from the real constant. */
export function inviteLifetimeHint(): string {
  return `邀请链接 ${INVITE_VALID_DAYS} 天内有效`;
}

/**
 * Normalises a note for the API: trims, collapses empty to undefined.
 *
 * The backend already maps blank→null, so this is about not sending a pointless
 * whitespace-only string, not about correctness.
 */
export function normalizeNote(note: string): string | undefined {
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Result copy for a successful accept, naming the inviter when we know them.
 *
 * Deliberately says 「已确认邀请」 rather than 「已加入协作」 (Legacy's wording):
 * nothing was joined.
 */
export function acceptedHeadline(result: CollaborationAcceptResult | null): string {
  const name = result ? inviterDisplayName(result) : null;
  return name ? `已确认 ${name} 的邀请` : "已确认邀请";
}

/**
 * Where to send the user after accepting.
 *
 * ⚠️ Legacy linked to `/u/{username}/works`, which does NOT exist in V2 — the
 * only route is `/u/:username`, and that page already renders the 公开作品
 * section. Copying Legacy's href verbatim would ship a guaranteed 404, so we
 * target the profile and let it show the works.
 *
 * Returns null when the username is unknown, so the caller hides the button
 * instead of rendering a link to /u/undefined.
 */
export function inviterSpaceHref(
  result: Pick<CollaborationAcceptResult, "inviterUsername"> | null,
): string | null {
  const username = result?.inviterUsername?.trim();
  if (!username) return null;
  return `/u/${encodeURIComponent(username)}`;
}
