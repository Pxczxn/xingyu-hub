import { apiRequest, apiRequestBlob } from "@/api/client";
import {
  GROUP_JOIN_REQUEST_LIMIT,
  messageAttachmentPath,
  newClientMessageId,
  toConversations,
  toMessages,
  type ChatMessage,
  type Conversation,
  type ConversationList,
  type ConversationType,
  type MessageBackfill,
  type MessageContext,
  type MessagePage,
  type MessageType,
  type MyGroupJoinRequest,
  type SendMessagePayload,
} from "./messages.types";

/*
 * Direct / group messaging API — send/receive core (Phase 2I-3) plus
 * attachments and search (Phase 2I-3b).
 *
 * Endpoint shapes are documented in messages.types.ts. The trap worth
 * repeating here because the calls are one line apart:
 *   - `listConversations()` hits `/api/v1/messages`         -> BARE ARRAY
 *   - `listMessages(id)`     hits `/api/v1/messages/{id}/messages` -> PageResult
 *   - `listMedia/listFiles/search`                         -> BARE ARRAY again
 * Only the per-thread history pages. Everything else is an array.
 *
 * `sendAttachment` is deliberately two calls (upload then send) rather than
 * one: the upload endpoint creates no message, and `filesApi` already owns the
 * transport contract. This module owns only the message half.
 *
 * Group administration and join requests are still absent; see
 * the types header for the deferred set. Saved messages are NO LONGER here as a
 * gap: `/me/saved-messages` was surfaced in Phase 3I and lives in its own module
 * (`@/api/saved-messages`). It is deliberately NOT re-exported from this one —
 * the mailbox API owns conversation reads, the bookmark API owns bookmarks.
 *
 * EXCEPTION (Phase 3C): `listMyGroupJoinRequests` IS here. It is the applicant's
 * own read-only view (`/me/group-join-requests`). The OWNER-side admin queue
 * (approve/reject) remains absent, and that is a scope decision, not an oversight.
 *
 * EXCEPTION (Phase 3E): `createGroup` IS here — `POST /messages/group` returning
 * a ConversationView. Group creation is what the "我的群聊" page needs; the rest
 * of the admin surface (`/settings`, `/announcement`, `/members`, `/leave`) stays
 * out. See §三·补17.
 */
export const messagesApi = {
  /** The mailbox. Mapper already sorts `updated_at DESC` — do not re-sort. */
  listConversations: async (): Promise<Conversation[]> =>
    toConversations(await apiRequest<ConversationList>("/api/v1/messages")),

  /** A DIRECT conversation with its message window (server caps it at 100). */
  getDirect: (conversationId: string): Promise<Conversation> =>
    apiRequest<Conversation>(`/api/v1/messages/direct/${encodeURIComponent(conversationId)}`),

  /**
   * Opens the DIRECT conversation with a user, creating it if needed.
   *
   * The backend resolves the argument as a userId first, then as a username, so
   * either form works — but this is the CREATOR path, not the reader path. To
   * read an existing conversation use `getDirect(conversationId)`.
   *
   * 409 when either party has blocked the other; 404 for an unknown user;
   * 400 when the argument is yourself.
   */
  openDirect: (otherUserId: string): Promise<Conversation> =>
    apiRequest<Conversation>(`/api/v1/messages/direct/${encodeURIComponent(otherUserId)}`, {
      method: "POST",
    }),

  /** A GROUP conversation with its message window (server caps it at 100). */
  getGroup: (conversationId: string): Promise<Conversation> =>
    apiRequest<Conversation>(`/api/v1/messages/group/${encodeURIComponent(conversationId)}`),

  /**
   * Creates a GROUP conversation and makes the caller its OWNER (Phase 3E).
   *
   * Takes ONLY `{ title }` — `createGroup` reads nothing else from the body
   * (`ConversationService:225-241`): it hardcodes `joinMode = OPEN` and inserts
   * a single OWNER member row. There is NO invitee list, so a new group always
   * starts with exactly one member. Do not offer an "invite members" field: the
   * endpoint would ignore it.
   *
   * 400 `title: 群聊标题不能为空` when the title is blank.
   */
  createGroup: (title: string): Promise<Conversation> =>
    apiRequest<Conversation>("/api/v1/messages/group", { method: "POST", body: { title } }),

  /**
   * Sends into a DIRECT conversation. Returns the created (or replayed) message.
   * Pass `clientMessageId` to make a retry idempotent.
   */
  sendDirect: (conversationId: string, payload: SendMessagePayload): Promise<ChatMessage> =>
    apiRequest<ChatMessage>(
      `/api/v1/messages/direct/${encodeURIComponent(conversationId)}/messages`,
      { method: "POST", body: payload },
    ),

  /** Sends into a GROUP conversation. Same payload contract as `sendDirect`. */
  sendGroup: (conversationId: string, payload: SendMessagePayload): Promise<ChatMessage> =>
    apiRequest<ChatMessage>(
      `/api/v1/messages/group/${encodeURIComponent(conversationId)}/messages`,
      { method: "POST", body: payload },
    ),

  /**
   * 一页更早的消息（`cursor` = 已持有的最旧序号），升序。
   *
   * `limit` 服务端钳 1..200。返回的 `nextCursor` 是这一页里最旧的序号。
   */
  listMessages: async (
    conversationId: string,
    options: { cursor?: string | null; limit?: number } = {},
  ): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> => {
    const limit = options.limit ?? 50;
    const params = new URLSearchParams({ limit: String(limit) });
    if (options.cursor) params.set("cursor", options.cursor);
    const page = await apiRequest<MessagePage>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/messages?${params.toString()}`,
    );
    return {
      messages: toMessages(page),
      nextCursor: page?.nextCursor ?? null,
    };
  },

  /**
   * 补齐 `afterSequence` 之后的消息，**升序**（2026-10-06）。
   *
   * 为什么需要：WebSocket 只做实时推送，不重放离线期间的消息。只重新握手而不调这里，
   * 断线期间的消息会一直看不到，直到用户手动刷新（实测过）。
   *
   * 传本地已知的最大 `sequenceNumber` 即可；不传则**从最早开始**（升序）。`hasMore` 为 true
   * 表示还有更新的，需要再调一轮。形状刻意不同于 `listMessages`（那边 nextCursor 表示「更旧」）。
   */
  listMessagesAfter: async (
    conversationId: string,
    afterSequence?: number | null,
    limit = 100,
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (afterSequence !== undefined && afterSequence !== null) {
      params.set("afterSequence", String(afterSequence));
    }
    const backfill = await apiRequest<MessageBackfill>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/messages/after?${params.toString()}`,
    );
    return {
      messages: Array.isArray(backfill?.messages) ? backfill.messages : [],
      hasMore: Boolean(backfill?.hasMore),
    };
  },

  /**
   * 以某条消息为中心的一小段历史（2026-10-06，搜索落点）。
   *
   * `sequence` 取自消息载荷里的会话内序号；一次请求就返回「目标之前 + 目标 + 目标之后」，
   * 所以从搜索点进一条远早于首屏的消息也不需要从最新一页一路往前翻。
   */
  listMessagesAround: async (
    conversationId: string,
    sequence: number,
    limit = 30,
  ): Promise<MessageContext> => {
    const params = new URLSearchParams({ sequence: String(sequence), limit: String(limit) });
    const context = await apiRequest<MessageContext>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/messages/around?${params.toString()}`,
    );
    return {
      messages: Array.isArray(context?.messages) ? context.messages : [],
      found: Boolean(context?.found),
      sequence: Number(context?.sequence ?? sequence),
    };
  },

  /**
   * 受鉴权地取一条消息的附件字节。
   *
   * 必须走这里而不是 `attachmentUrl`：那个地址指向 `/api/v1/admin/files/...`，该路径
   * **不做会话校验**，其目录已被静态控制器拒绝。返回 Blob，由调用方转 object URL
   * （`<img src>` 带不上 satoken 头）。
   */
  downloadAttachment: (conversationId: string, messageId: string): Promise<Blob> =>
    apiRequestBlob(messageAttachmentPath(conversationId, messageId)),

  /**
   * Marks a conversation read.
   *
   * With no `sequenceNumber` the backend marks everything currently in the
   * conversation read; passing one marks up to (and including) it. Idempotent —
   * only advances, never regresses.
   */
  markRead: (conversationId: string, sequenceNumber?: number): Promise<void> =>
    apiRequest<void>(`/api/v1/messages/${encodeURIComponent(conversationId)}/read`, {
      method: "PATCH",
      body: sequenceNumber === undefined ? undefined : { sequenceNumber: String(sequenceNumber) },
    }),

  /**
   * Recalls one of your own messages.
   *
   * 403 if it is not yours, 409 once the recall window has closed, and it is
   * idempotent (recalling an already-recalled message returns it unchanged).
   */
  recallMessage: (conversationId: string, messageId: string): Promise<ChatMessage> =>
    apiRequest<ChatMessage>(
      `/api/v1/messages/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/recall`,
      { method: "POST" },
    ),

  /**
   * Sends a file or image into a conversation (Phase 2I-3b).
   *
   * Two steps on purpose: upload the bytes, then send a message referencing the
   * returned URL. The upload endpoint is NOT message-scoped — it stores a file
   * and hands back a URL, creating no message — so the transport lives in
   * `filesApi.uploadFile`, and this wrapper is the second half.
   *
   * The message type is derived from the extension, not declared by the caller:
   * an image becomes IMAGE (listed by /media, rendered as a thumbnail) and
   * everything else becomes FILE. The backend stores whatever `type` it is
   * given without re-deriving it, so this is the only place that decision is
   * made.
   *
   * Callers MUST validate first (`validateMessageAttachment`) — a rejected
   * extension comes back as 500, which tells the user nothing.
   */
  sendAttachment: async (
    conversationId: string,
    type: ConversationType,
    file: { url: string; name: string; messageType: MessageType; fileId: number | null },
  ): Promise<ChatMessage> => {
    const payload: SendMessagePayload = {
      type: file.messageType,
      attachmentUrl: file.url,
      attachmentName: file.name,
      // 附件必须带上 sys_file.id，否则消息行没有任何可用于鉴权下载的凭据（2026-10-06）。
      attachmentFileId: file.fileId,
      // A caption would go in `body`, but the composer sends the attachment on
      // its own. The backend keeps `body` empty for an attachment-only message.
      clientMessageId: newClientMessageId(),
    };
    return type === "GROUP"
      ? messagesApi.sendGroup(conversationId, payload)
      : messagesApi.sendDirect(conversationId, payload);
  },

  /**
   * Every IMAGE message in a conversation, newest first.
   *
   * A BARE ARRAY, not a page. The backend filters by stored message type, so no
   * client-side filtering is involved and a TEXT/recalled row cannot appear.
   * `limit` is clamped to 1..200 server-side.
   */
  listMedia: async (conversationId: string, limit = 50): Promise<ChatMessage[]> =>
    toMessages(
      await apiRequest<ChatMessage[]>(
        `/api/v1/messages/${encodeURIComponent(conversationId)}/media?limit=${limit}`,
      ),
    ),

  /**
   * Every FILE message in a conversation, newest first. Same shape and caps as
   * `listMedia`, and disjoint from it — an image is never in this list.
   */
  listFiles: async (conversationId: string, limit = 50): Promise<ChatMessage[]> =>
    toMessages(
      await apiRequest<ChatMessage[]>(
        `/api/v1/messages/${encodeURIComponent(conversationId)}/files?limit=${limit}`,
      ),
    ),

  /**
   * Searches the caller's messages ACROSS EVERY conversation they belong to.
   *
   * A BARE ARRAY. `limit` is clamped to 1..100 server-side.
   *
   * A blank query short-circuits to an empty list on the server without an
   * error, so callers should not call this with an empty string and present the
   * result as a search — see SearchMessagesPage.
   */
  search: async (query: string, limit = 50): Promise<ChatMessage[]> => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return toMessages(
      await apiRequest<ChatMessage[]>(`/api/v1/messages/search?${params.toString()}`),
    );
  },

  /**
   * The group join requests the CALLER has submitted (Phase 3C).
   *
   * `GET /api/v1/me/group-join-requests?limit=20` — a BARE ARRAY, capped at 100
   * server-side. This is the applicant's own view; the owner's approve/reject
   * queue is a different endpoint (`/messages/group/{id}/join-requests`) and is
   * deliberately not exposed here.
   *
   * ⚠️ The returned rows are `MyGroupJoinRequestView`, NOT `GroupJoinRequestView`.
   * See the type's doc comment — the two look alike and the wrong one silently
   * loses `conversationTitle` and `resolvedAt`.
   */
  listMyGroupJoinRequests: async (
    limit: number = GROUP_JOIN_REQUEST_LIMIT,
  ): Promise<MyGroupJoinRequest[]> =>
    apiRequest<MyGroupJoinRequest[]>(
      `/api/v1/me/group-join-requests?limit=${encodeURIComponent(String(limit))}`,
    ),
};
