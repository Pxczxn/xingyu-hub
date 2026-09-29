import type { Conversation } from "@/api/messages/messages.types";

/*
 * Pure logic for /me/groups (我的群聊) — Phase 3E.
 *
 * The mailbox returns DIRECT and GROUP rows in ONE list (`GET /messages`), so
 * this module owns the split — plus the owner/admin affordances, which come
 * from `myRole` on the row rather than a second request.
 */

/** Rows to show on the groups page: GROUP only, preserving the server's order. */
export function filterGroups(conversations: Conversation[]): Conversation[] {
  return conversations.filter((conversation) => conversation.type === "GROUP");
}

/**
 * The row's display title.
 *
 * A GROUP row CAN carry a null title in the database (the column is nullable and
 * `setTitle` is only called from the GROUP paths — so in practice a GROUP has
 * one). We still guard: falling back to an empty string would render a blank
 * clickable row, which reads as a rendering bug. `conversationLabel` supplies
 * 「未命名群聊」 for GROUP and is reused rather than re-implemented.
 */
export function groupTitle(conversation: Conversation): string {
  const title = conversation.title?.trim();
  return title || "未命名群聊";
}

/**
 * Is the caller allowed to administer this group?
 *
 * `myRole` is only meaningful for GROUP rows. The backend's write guards use
 * `requireOwnerOrAdmin`, so this must match: OWNER or ADMIN. A DIRECT row always
 * reports "MEMBER" and is filtered out before this is called anyway.
 */
export function canAdminister(conversation: Conversation): boolean {
  return conversation.myRole === "OWNER" || conversation.myRole === "ADMIN";
}

/** Human label for the caller's role. Unknown values are echoed, not guessed. */
export function roleLabel(role: string | null | undefined): string | null {
  switch (role) {
    case "OWNER":
      return "群主";
    case "ADMIN":
      return "管理员";
    case "MEMBER":
      return "成员";
    case null:
    case undefined:
      return null;
    default:
      // An enum we do not know yet — show it verbatim rather than mislabelling.
      return role;
  }
}

/** Join-mode note, or null when the server did not send one. */
export function joinModeNote(mode: string | null | undefined): string | null {
  switch (mode) {
    case "OPEN":
      return "开放加入";
    case "APPROVAL":
      return "需审批加入";
    case null:
    case undefined:
      return null;
    default:
      return mode;
  }
}

export type CreateGroupResult =
  | { ok: true; title: string }
  | { ok: false; reason: "empty" | "too_long"; message: string };

/**
 * Validate a new group title before calling the API.
 *
 * The backend's ONLY check is `title == null || isBlank` (`ConversationService:227`).
 * There is no length cap server-side, so the cap here is a front-end guard
 * against an absurd title — the constant is named to say so. Whitespace-only
 * input is rejected locally so the user gets an inline message instead of a
 * round-trip 400.
 */
export const MAX_GROUP_TITLE_LENGTH = 50;

export function validateGroupTitle(raw: string): CreateGroupResult {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, reason: "empty", message: "请输入群聊名称" };
  if (value.length > MAX_GROUP_TITLE_LENGTH) {
    return { ok: false, reason: "too_long", message: `群聊名称不超过 ${MAX_GROUP_TITLE_LENGTH} 个字符` };
  }
  return { ok: true, title: value };
}

/**
 * Where a group row should link.
 *
 * V2 serves groups through the SAME `/messages/:conversationId` route as DIRECT
 * (the thread page tries `getDirect` then falls back to `getGroup` on 404). So
 * there is exactly one href shape and no per-type branching — unlike Legacy,
 * which linked to `/messages/group/{id}`, a route it never actually defined.
 */
export function groupHref(conversation: Conversation): string {
  return `/messages/${encodeURIComponent(conversation.id)}`;
}

/** `updatedAt` is only bumped on send; a brand-new group can lack it. */
export function groupUpdatedLabel(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}
