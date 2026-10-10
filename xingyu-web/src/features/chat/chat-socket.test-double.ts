import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { ChatEvent, ChatSocketContextValue } from "./chat-socket.context";

/*
 * Test double for the chat socket context.
 *
 * The real provider owns a WebSocket and a reconnect loop; component tests care about
 * neither — they care about "a frame arrived" and "what the shared conversation list
 * says". So they mock `useChatSocket` with this double and drive it directly:
 *
 *   chatSocket.myUserId = "user-me"        // pretend the handshake happened
 *   chatSocket.emit({ kind: "message", … }) // deliver a frame
 *   chatSocket.conversations = [...]        // what the mailbox / header will read
 *
 * The PROVIDER's own behaviour (one connection, dispatch, reconnect backfill) is tested
 * in chat-socket.test.tsx with an injected WebSocket.
 */

type Listener = (event: ChatEvent) => void;

const listeners = new Set<Listener>();

export const chatSocket = {
  connection: "open" as ChatSocketContextValue["connection"],
  myUserId: null as string | null,
  conversations: null as ChatSocketContextValue["conversations"],
  conversationsStatus: "ready" as ChatSocketContextValue["conversationsStatus"],
  conversationsError: null as string | null,
  conversationsExpired: false,
  unreadTotal: 0 as number | null,
  watchConversation: vi.fn(),
  refreshConversations: vi.fn(async () => {}),
  /** Frames the page asked the provider to backfill, in order. */
  watched: [] as Array<{ conversationId: string | null; knownMaxSequence: number }>,
};

export function resetChatSocketDouble(): void {
  listeners.clear();
  chatSocket.connection = "open";
  chatSocket.myUserId = null;
  chatSocket.conversations = null;
  chatSocket.conversationsStatus = "ready";
  chatSocket.conversationsError = null;
  chatSocket.conversationsExpired = false;
  chatSocket.unreadTotal = 0;
  chatSocket.watched = [];
  chatSocket.watchConversation.mockClear();
  chatSocket.refreshConversations.mockClear();
  chatSocket.refreshConversations.mockResolvedValue(undefined);
}

/** The value `useChatSocket` returns while mocked. */
export function chatSocketValue(): ChatSocketContextValue {
  return {
    connection: chatSocket.connection,
    myUserId: chatSocket.myUserId,
    conversations: chatSocket.conversations,
    conversationsStatus: chatSocket.conversationsStatus,
    conversationsError: chatSocket.conversationsError,
    conversationsExpired: chatSocket.conversationsExpired,
    unreadTotal: chatSocket.unreadTotal,
    refreshConversations: chatSocket.refreshConversations,
    watchConversation: (conversationId, knownMaxSequence) => {
      chatSocket.watched.push({ conversationId, knownMaxSequence });
      chatSocket.watchConversation(conversationId, knownMaxSequence);
    },
    subscribe: (handler: Listener) => {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };
}

/** Deliver a frame to every subscriber, wrapped in act() like a user interaction. */
export function emitChatEvent(event: ChatEvent): void {
  act(() => {
    for (const listener of listeners) listener(event);
  });
}
