import { apiRequest } from "@/api/client";
import {
  newClientMessageId,
  toConversations,
  toMessages,
  type ChatMessage,
  type Conversation,
  type ConversationList,
  type ConversationType,
  type MessagePage,
  type MessageType,
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
 * Group administration, join requests and saved messages are still absent; see
 * the types header for the deferred set.
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
   * One page of older messages, ascending.
   *
   * `cursor` is the oldest sequence already held; omit it for the newest page.
   * The returned `nextCursor` is that page's oldest sequence, so it is the
   * cursor for the next call. `limit` is clamped to 1..200 server-side.
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
    file: { url: string; name: string; messageType: MessageType },
  ): Promise<ChatMessage> => {
    const payload: SendMessagePayload = {
      type: file.messageType,
      attachmentUrl: file.url,
      attachmentName: file.name,
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
};
