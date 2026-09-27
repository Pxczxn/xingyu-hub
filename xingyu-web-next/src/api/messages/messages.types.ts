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
 * ── Endpoints this phase uses (scope: send/receive core) ────────────────────
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
 * Deliberately NOT in this phase (deferred to 2I-3b, endpoints confirmed to
 * exist and return 401): group create/settings/announcement/members/leave/
 * remove-member, join requests (list/submit/approve/reject), my join requests,
 * /media, /files, /search, /me/saved-messages, /messages/upload wiring.
 *
 * ── Shapes that will bite ───────────────────────────────────────────────────
 *
 * 1. THE CONVERSATION LIST IS A BARE ARRAY; THE MESSAGE LIST IS A PageResult.
 *    They are two different endpoints with two different shapes, and swapping
 *    them blanks the screen. `toConversations` / `toMessages` pin each one.
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

/** Sum of `unreadCount` across the mailbox. This is the only unread total. */
export function countUnreadConversations(items: Conversation[]): number {
  return items.reduce((total, item) => total + (item.unreadCount ?? 0), 0);
}

/** A recalled message is a tombstone: it keeps its slot but has no content. */
export function isRecalled(message: ChatMessage): boolean {
  return message.recalledAt != null;
}

/**
 * Display name for the other party of a DIRECT conversation.
 *
 * The backend's `title` for DIRECT is produced by `formatLastMessagePreview`'s
 * sibling logic and can be blank when neither profile nor username is known, so
 * fall back to something readable rather than an empty row.
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
