/*
 * Saved-messages contract (Phase 3I, verified against the backend record
 * 2026-09-28).
 *
 * Controller: CommunityMeController  @RequestMapping("/me")
 *   GET    /api/v1/me/saved-messages?limit=50        -> SavedMessageView[]  BARE ARRAY
 *   POST   /api/v1/me/saved-messages  {messageId}    -> SavedMessageView
 *   DELETE /api/v1/me/saved-messages/{messageId}     -> 204 No Content
 *
 * DTO (SavedMessageView — read the record, do not extrapolate):
 *   {id, messageId, conversationId, conversationType, conversationTitle,
 *    messageType, body, attachmentUrl, attachmentName, senderId,
 *    messageCreatedAt, savedAt}
 *
 * ── Shapes that will bite ───────────────────────────────────────────────────
 *
 * 1. THE LIST IS A BARE ARRAY. There is no page envelope, so `toSavedMessages`
 *    tolerates one defensively but the normal path returns the array itself.
 *
 * 2. THE `id` ON A ROW IS THE **BOOKMARK** id, NOT the message id. The DELETE
 *    path takes the MESSAGE id (`/saved-messages/{messageId}`), and
 *    `SavedMessageService.removeSaved` looks the bookmark up by
 *    (userId, messageId) — so `row.id` must never be passed to delete. Use
 *    `row.messageId`. This is the §三·补 type of mistake that a unit test with
 *    a self-authored mock cannot catch.
 *
 * 3. SAVING IS IDEMPOTENT. `saveMessage` returns the EXISTING bookmark when one
 *    already exists, so a double-save is a no-op and a 200 either way.
 *
 * 4. 404, NOT 403, FOR NON-MEMBERSHIP. To save a message the caller must be a
 *    member of its conversation; `requireMember` throws NOT_FOUND when they are
 *    not. So "message I cannot see" and "message that does not exist" are the
 *    same answer, on purpose.
 *
 * 5. `body` IS THE SERVED STRING. For a recalled message the server has already
 *    blanked it to 「[消息已撤回]」 — the same tombstone rule as `ChatMessage`.
 *    For an IMAGE/FILE message with no caption, the service stores the
 *    attachment URL in `body`, so render the attachment and suppress a body
 *    that merely repeats the URL.
 *
 * 6. NO UNREAD / NO ORDERING PROMISE BEYOND THE QUERY. `listByUserId` caps at
 *    100 (`Math.min(Math.max(limit,1),100)`); the endpoint's default is 50.
 */

export type SavedMessageView = {
  /** The BOOKMARK row id. Not accepted by any endpoint — use `messageId` to delete. */
  id: string;
  /** The underlying message id. This is what `DELETE` takes. */
  messageId: string;
  conversationId: string;
  /** `DIRECT` | `GROUP` (the conversation row's type). */
  conversationType?: string | null;
  /**
   * Group title only. Null for a DIRECT conversation — the backend does not
   * derive a peer nickname into it (same rule as `Conversation.title`), so the
   * UI supplies the copy.
   */
  conversationTitle?: string | null;
  /** `TEXT` | `IMAGE` | `FILE`; the service defaults a null to `TEXT`. */
  messageType?: string | null;
  /** Served display string. 「[消息已撤回]」 for a recalled message. */
  body?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  senderId: string;
  /** When the message was sent. Nullable in the DB. */
  messageCreatedAt?: string | null;
  /** When the bookmark was created. */
  savedAt?: string | null;
};

/** What `GET /me/saved-messages` actually returns. */
export type SavedMessageList = SavedMessageView[];

/** The endpoint's own default (`@RequestParam(defaultValue = "50")`). */
export const SAVED_MESSAGE_LIMIT = 50;

/** The service cap (`Math.min(Math.max(limit,1),100)`). */
export const SAVED_MESSAGE_MAX_LIMIT = 100;

/** `GET /me/saved-messages` is a bare array; tolerate an envelope so it cannot blank. */
export function toSavedMessages(raw: SavedMessageList | null | undefined): SavedMessageView[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const items = (raw as { items?: unknown }).items;
  return Array.isArray(items) ? (items as SavedMessageView[]) : [];
}

/**
 * A label for the conversation a bookmark came from.
 *
 * A DIRECT conversation has no stored title, so this returns 「私信」; a group
 * with a title uses it, and a title-less group gets 「未命名群聊」. Mirrors
 * `conversationLabel` in the messages module rather than importing it, because
 * the two types are structurally different and coupling them would be a lie.
 */
export function savedConversationLabel(item: SavedMessageView): string {
  const title = item.conversationTitle?.trim();
  if (title) return title;
  return item.conversationType === "GROUP" ? "未命名群聊" : "私信";
}

/** True when the body is only a restatement of its attachment URL. */
export function savedBodyRepeatsAttachment(item: SavedMessageView): boolean {
  const body = item.body?.trim();
  const url = item.attachmentUrl?.trim();
  return Boolean(body && url && body === url);
}

/**
 * The display body for a bookmark, or null when there is nothing to show.
 *
 * Null for an attachment-only message (the body is just the URL). The
 * tombstone text 「[消息已撤回]」 is returned as-is when the backend set it —
 * detection elsewhere is keyed off nothing else, because a bookmark row carries
 * no `recalledAt`; the server already decided the string.
 */
export function savedMessageBody(item: SavedMessageView): string | null {
  const body = item.body?.trim();
  if (!body) return null;
  if (savedBodyRepeatsAttachment(item)) return null;
  return body;
}

/** `IMAGE` / `FILE` rows carry an attachment worth rendering. */
export function savedAttachmentKind(item: SavedMessageView): "image" | "file" | null {
  if (!item.attachmentUrl) return null;
  if (item.messageType === "IMAGE") return "image";
  if (item.messageType === "FILE") return "file";
  return null;
}

/**
 * A short, honest sender label when no profile is available.
 *
 * The bookmark carries only `senderId`, so this never invents a name — same
 * policy as `senderLabel` in the messages module.
 */
export function savedSenderLabel(senderId: string): string {
  const trimmed = senderId?.trim();
  if (!trimmed) return "某位成员";
  return trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

/** Compact `MM-DD HH:mm` in Beijing time, or null when the value is unusable. */
export function formatSavedTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

/**
 * A deep link into the conversation the bookmark came from.
 *
 * `savedMessageView.conversationId` is the same id `MailboxPage` accepts as its
 * `:conversationId` param, so this always resolves to a real route — no
 * allowlist needed, unlike server-supplied `href` strings.
 */
export function savedConversationHref(item: SavedMessageView): string {
  return `/messages/${encodeURIComponent(item.conversationId)}`;
}
