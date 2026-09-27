import { apiRequest } from "@/api/client";
import {
  toConversations,
  toMessages,
  type ChatMessage,
  type Conversation,
  type ConversationList,
  type MessagePage,
  type SendMessagePayload,
} from "./messages.types";

/*
 * Direct / group messaging API — send/receive core only (Phase 2I-3).
 *
 * Endpoint shapes are documented in messages.types.ts. The two traps worth
 * repeating here because they are one line apart:
 *   - `listConversations()` hits `/api/v1/messages`       -> BARE ARRAY
 *   - `listMessages(id)`     hits `/api/v1/messages/{id}/messages` -> PageResult
 *
 * Group administration, attachments-as-a-feature, search and saved messages are
 * deliberately absent; see the types header for the deferred set.
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
};
