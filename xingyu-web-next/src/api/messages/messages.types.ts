/*
 * Direct / group messaging contract (Phase 2I-3, four-source confirmed 2026-09-27).
 *
 * Controller: CommunityMessageController  @RequestMapping("/messages")
 *             CommunityMeController       (the /me/saved-messages + join-request reads)
 * DTOs:       ConversationView   {id, type, title, updatedAt, lastMessage, unreadCount,
 *                                 announcement, announcementUpdatedAt, joinMode, myRole, messages}
 *             ChatMessageView    {id, conversationId, conversationType, senderId,
 *                                 sequenceNumber, body, messageType, attachmentUrl,
 *                                 attachmentName, createdAt, recalledAt}
 *             ConversationMemberView {userId, username, displayName, role}
 *             PageResultView<T>  {items, nextCursor, total}
 *
 * ── Endpoints used ──────────────────────────────────────────────────────────
 * Send/receive core (2I-3):
 *   GET    /api/v1/messages                                   -> ConversationView[]  BARE ARRAY
 *   GET    /api/v1/messages/direct/{conversationId}            -> ConversationView (incl. messages)
 *   POST   /api/v1/messages/direct/{otherUserId}               -> ConversationView  (open/create)
 *   POST   /api/v1/messages/direct/{conversationId}/messages   -> ChatMessageView
 *   GET    /api/v1/messages/group/{conversationId}             -> ConversationView (incl. messages)
 *   POST   /api/v1/messages/group/{conversationId}/messages    -> ChatMessageView
 *   GET    /api/v1/messages/{conversationId}/messages?cursor=&limit=50
 *                                                             -> PageResult<ChatMessageView>
 *   PATCH  /api/v1/messages/{conversationId}/read              -> 204
 *   POST   /api/v1/messages/{conversationId}/messages/{messageId}/recall -> ChatMessageView
 *
 * Attachments + search (2I-3b):
 *   POST   /api/v1/messages/upload                            -> {url, name, mimeType}
 *   GET    /api/v1/messages/{conversationId}/media?limit=50    -> ChatMessageView[]  BARE ARRAY
 *   GET    /api/v1/messages/{conversationId}/files?limit=50    -> ChatMessageView[]  BARE ARRAY
 *   GET    /api/v1/messages/search?q=&limit=50                 -> ChatMessageView[]  BARE ARRAY
 *   (upload is not message-scoped on the backend: it stores a file and returns a
 *    URL. It creates no message and touches no conversation. See files.api.ts.)
 *
 * Still deferred: group create/settings/announcement/members/leave/remove-member,
 * join requests (list/submit/approve/reject), my join requests.
 *
 * NOTE: `/me/saved-messages` USED to be on this deferred list. It was surfaced
 * in Phase 3I and now has its own module (`@/api/saved-messages`), because a
 * bookmark store is not a mailbox read and the two shapes share nothing.
 *
 * ── Shapes that will bite ───────────────────────────────────────────────────
 *
 * 1. THE CONVERSATION LIST IS A BARE ARRAY; THE MESSAGE LIST IS A PageResult.
 *    They are two different endpoints with two different shapes, and swapping
 *    them blanks the screen. `toConversations` / `toMessages` pin each one.
 *    `/media`, `/files` and `/search` are ALSO bare arrays, not pages — only
 *    `GET /{id}/messages` pages.
 *
 * 2. `POST /direct/{id}` IS OVERLOADED. The same path prefix takes EITHER a
 *    conversationId (returns a direct conversation) OR a userId/username (opens
 *    or creates one). The service resolves it by trying userId first, then
 *    username. So the frontend must never guess: `openDirect(userId)` is the
 *    creator path, `getDirect(conversationId)` the reader path.
 *
 * 3. `messages[]` ON A ConversationView IS CAPPED AT 100 and comes back
 *    ASCENDING. Both getDirect and getGroup call `listMessages(..., null, 100)`
 *    internally. For anything longer, page through
 *    `GET /{conversationId}/messages` (ordered DESC by sequence before the
 *    cursor, then reversed by the service -> ascending; `nextCursor` is the
 *    OLDEST sequence in the page).
 *
 * 4. `unreadCount` IS PER-CONVERSATION, NOT PER-MAILBOX. There is no "unread
 *    messages" total endpoint — a badge must sum this field across the list.
 *    `countUnread` compares `sequence_number > last_read_sequence`.
 *
 * 5. A RECALLED MESSAGE KEEPS ITS SLOT. The backend blanks `body` to
 *    「[消息已撤回]」 and nulls the attachments but leaves `recalledAt` set and
 *    the row in place, so message order never shifts. Render it as a tombstone.
 *
 * 6. `sequenceNumber` (not `id`) IS THE ORDERING KEY and the read cursor.
 *    `markRead(conversationId, sequenceNumber?)` with no sequence marks
 *    everything currently in the conversation read.
 *
 * 7. `updatedAt` IS ONLY BUMPED ON SEND, and `updatedAt` on a conversation row
 *    can be null for a freshly created DIRECT conversation (only `createdAt` is
 *    set). The list is pre-sorted `updated_at DESC` by the mapper, so the
 *    frontend must NOT re-sort — a null would sort unpredictably.
 *
 * 8. `/media` RETURNS ONLY `IMAGE` ROWS and `/files` ONLY `FILE` rows
 *    (`listByConversationIdAndType`). Neither is a filter the client applies —
 *    a TEXT message can never appear in either, and the two lists are disjoint.
 *    `/media` is also capped at 200 server-side, `/files` likewise; `/search`
 *    caps at 100.
 *
 * 9. `/search` IS MAILBOX-WIDE, NOT PER-CONVERSATION. `searchForUser` matches
 *    across every conversation the caller belongs to, and the service fills
 *    `conversationType` from the owning row — which is why that field exists on
 *    a search hit at all. A blank query short-circuits to `[]` server-side (no
 *    400), so the UI must not send an empty `q` and pretend it searched.
 */

export type ConversationType = "DIRECT" | "GROUP";

export type MessageType = "TEXT" | "IMAGE" | "FILE";

/** Group only. `myRole` on a DIRECT conversation is always "MEMBER". */
export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export type JoinMode = "OPEN" | "APPROVAL";

export type ChatMessage = {
  id: string;
  conversationId: string;
  /** Null on `/messages/search` hits (the service does not fill it there). */
  conversationType?: ConversationType | null;
  senderId: string;
  /** Ordering key + read cursor. Never null (service defaults it to 0). */
  sequenceNumber: number;
  /** 「[消息已撤回]」 for a recalled message. */
  body: string;
  messageType: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt?: string | null;
  /** Non-null == recalled. Render as a tombstone, not as content. */
  recalledAt?: string | null;
};

export type Conversation = {
  id: string;
  type: ConversationType;
  /**
   * Group title. NULL for a DIRECT conversation, and the backend does NOT
   * derive a peer nickname to fill it: `conversation.title` is documented as
   * 「群聊标题」 in V016, `openDirect` never calls `setTitle`, and the only two
   * `setTitle` call sites in ConversationService are both GROUP paths
   * (createGroup, updateGroupAnnouncement). So a DIRECT row arrives with
   * `title === null` and `conversationLabel` supplies the copy — which is why
   * this must stay nullable rather than being normalised to "".
   */
  title: string | null;
  /** Null for a brand-new conversation with no messages yet. */
  updatedAt?: string | null;
  /** Server-formatted preview: text, 「[图片]」, 「[文件] name」, 「[消息已撤回]」. */
  lastMessage?: string | null;
  unreadCount: number;
  announcement?: string | null;
  announcementUpdatedAt?: string | null;
  joinMode?: JoinMode | null;
  myRole?: GroupRole | string | null;
  /** Only present on the detail endpoints; capped at 100, ascending. */
  messages?: ChatMessage[];
};

/** The shape `GET /messages` actually returns — a bare array. */
export type ConversationList = Conversation[];

/** The shape `GET /messages/{id}/messages` actually returns. */
export type MessagePage = {
  items: ChatMessage[];
  nextCursor?: string | null;
  total?: number | null;
};

/**
 * `MyGroupJoinRequestView` (Phase 3C).
 *
 * `GET /api/v1/me/group-join-requests?limit=20` returns these — verified against
 * the backend record on 2026-09-28.
 *
 * ⚠️ THERE ARE **TWO** SIMILARLY-NAMED DTOs. This is the one the `/me/*` endpoint
 * returns:
 *
 *   MyGroupJoinRequestView  -> (id, conversationId, conversationTitle, joinMode,
 *                               message, status, createdAt, resolvedAt)   <-- /me/*
 *   GroupJoinRequestView    -> (id, conversationId, userId, username,
 *                               displayName, message, status, createdAt)  <-- group-owner side
 *
 * The owner-side one has NO `conversationTitle` and NO `resolvedAt`, and carries
 * the APPLICANT's identity instead. They are the same-looking VOs for opposite
 * audiences. Do not "simplify" this type by copying the other one — read which
 * endpoint you are on first. (This is the same trap as §三·补13 flagged.)
 *
 * Nullability mirrors the service: `conversationTitle` is null when the
 * conversation row is gone, and `message`/`resolvedAt` are nullable in the DB.
 */
export type MyGroupJoinRequest = {
  id: string;
  conversationId: string;
  /** Null when the conversation no longer exists (`ConversationService:177`). */
  conversationTitle?: string | null;
  /** `OPEN` | `APPROVAL`; falls back to `OPEN` when the conversation is gone. */
  joinMode?: string | null;
  /** The applicant's own note. Null in the DB; "" is also possible on the wire. */
  message?: string | null;
  /** `PENDING` -> `APPROVED` | `REJECTED`. Those three only (see the service). */
  status: string;
  createdAt: string;
  /** Set only once the owner has acted. */
  resolvedAt?: string | null;
};

/** The three states a group join request can actually be in. */
export const JOIN_REQUEST_PENDING = "PENDING";
export const JOIN_REQUEST_APPROVED = "APPROVED";
export const JOIN_REQUEST_REJECTED = "REJECTED";

/** `OPEN` groups admit anyone, so a request row for one is anomalous. */
export const JOIN_MODE_OPEN = "OPEN";
export const JOIN_MODE_APPROVAL = "APPROVAL";

/** The endpoint's own default (`@RequestParam(defaultValue = "20")`). */
export const GROUP_JOIN_REQUEST_LIMIT = 20;

/** The service caps at 100 (`Math.min(Math.max(limit,1),100)`). */
export const GROUP_JOIN_REQUEST_MAX_LIMIT = 100;

/** Body accepted by both send endpoints. `type` defaults to TEXT server-side. */
export type SendMessagePayload = {
  body?: string;
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  /**
   * Idempotency key. The backend returns the existing message when the same
   * (conversationId, senderId, clientMessageId) triple is replayed, so a retry
   * after a flaky network cannot double-post.
   */
  clientMessageId?: string;
};

/*
 * Attachment rules (Phase 2I-3b).
 *
 * The transport is `POST /api/v1/messages/upload` and its whitelist is
 * `CommunityMessageController.COMMUNITY_ATTACHMENT_EXTENSIONS` — sixteen
 * extensions, wider than the avatar flow's five. A bad extension is answered
 * with 500 INTERNAL_ERROR, not 400, so pre-flight validation is the only way to
 * give the user a real reason. See files.api.ts for the transport contract.
 */

/** Exactly the controller's whitelist, lower-cased. Keep in sync. */
export const MESSAGE_ATTACHMENT_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "md", "csv", "zip",
] as const;

/** The subset of the whitelist that is an image — these become IMAGE messages. */
export const MESSAGE_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"] as const;

/** `sys_config_group.storage.maxSize`, in MB, converted to bytes. */
export const MESSAGE_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;

/** Human-readable mirror of the byte limit for hint text. */
export const MESSAGE_ATTACHMENT_MAX_LABEL = "100 MB";

/** One message for every rejection — the reason is the same either way. */
export const MESSAGE_ATTACHMENT_ERROR = "仅支持图片、PDF、Office 文档、TXT/MD/CSV、ZIP 附件";

/**
 * Which `messageType` an attachment should be sent as, or null when the file is
 * not an accepted attachment at all.
 *
 * Images become IMAGE (so `/media` lists them and the thread renders a
 * thumbnail); everything else in the whitelist becomes FILE. This mirrors the
 * backend, which stores the type the caller declares and never re-derives it
 * from the extension.
 */
export function attachmentMessageType(fileName: string): MessageType | null {
  const extension = fileExtensionOf(fileName);
  if ((MESSAGE_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) return "IMAGE";
  if ((MESSAGE_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) return "FILE";
  return null;
}

/**
 * Validate a candidate message attachment.
 *
 * Returns an error message to show the user, or `null` when acceptable. The
 * extension is authoritative because the backend only looks at the extension;
 * `file.type` is a secondary signal and an empty type is allowed through rather
 * than blocking a file the browser simply did not label.
 */
export function validateMessageAttachment(file: File): string | null {
  const extension = fileExtensionOf(file.name ?? "");
  if (!(MESSAGE_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return MESSAGE_ATTACHMENT_ERROR;
  }
  if (file.size <= 0) {
    return "文件内容为空，请重新选择";
  }
  if (file.size > MESSAGE_ATTACHMENT_MAX_BYTES) {
    return `附件不能超过 ${MESSAGE_ATTACHMENT_MAX_LABEL}`;
  }
  return null;
}

/** Lower-cased extension of a file name, or "" when there is none. */
function fileExtensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

/*
 * Defensive unwraps + small derivations.
 */

/** `GET /messages` is a bare array; tolerate an envelope so it cannot blank. */
export function toConversations(raw: ConversationList | null | undefined): Conversation[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  const items = (raw as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Conversation[]) : [];
}

/** `GET /messages/{id}/messages` is a PageResult; tolerate a bare array too. */
export function toMessages(raw: MessagePage | ChatMessage[] | null | undefined): ChatMessage[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw.items) ? raw.items : [];
}

/*
 * `/media`, `/files` and `/search` also return bare arrays, which `toMessages`
 * already tolerates — so they reuse it rather than growing a second unwrapper
 * that could drift from this one.
 */

/** Sum of `unreadCount` across the mailbox. This is the only unread total. */
export function countUnreadConversations(items: Conversation[]): number {
  return items.reduce((total, item) => total + (item.unreadCount ?? 0), 0);
}

/** A recalled message is a tombstone: it keeps its slot but has no content. */
export function isRecalled(message: ChatMessage): boolean {
  return message.recalledAt != null;
}

/**
 * Display name for a conversation row.
 *
 * A DIRECT conversation has NO title on the backend: the column is documented
 * as 「群聊标题」 (V016), `openDirect` never calls `setTitle`, and the only two
 * `setTitle` call sites in ConversationService are both GROUP paths. Nothing
 * derives the peer's name into it, so the fallback below is the normal path for
 * DIRECT, not an edge case.
 */
export function conversationLabel(conversation: Conversation): string {
  const title = conversation.title?.trim();
  if (title) return title;
  return conversation.type === "GROUP" ? "未命名群聊" : "私信";
}

/** Ascending by sequence — the backend already returns them this way. */
export function sortBySequence(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

/**
 * Merge a page of older messages (prepended history) into the current window.
 *
 * De-duplicates by id because `nextCursor` is the oldest loaded sequence: a
 * page boundary can legitimately overlap the window already on screen, and a
 * duplicate React key would warn and drop a row.
 */
export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return sortBySequence([...byId.values()]);
}

/** A stable client-side id for the idempotency key on send. */
export function newClientMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
