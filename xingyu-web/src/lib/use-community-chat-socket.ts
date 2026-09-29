import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/api/messages/messages.types";
import { getStoredToken } from "@/lib/storage";

/*
 * Community chat WebSocket (Phase 2I-3) — migrated from Legacy
 * `lib/use-community-chat-socket.ts`.
 *
 * Backend contract (verified by reading the Java, 2026-09-27):
 *   - `WebSocketConfig` registers `CommunityChatWebSocketHandler` at
 *     `/ws/community/chat`, with `CommunityWebSocketHandshakeInterceptor`.
 *   - The interceptor reads the session token from the `token` query parameter
 *     (falling back to a `satoken` header) and requires an ACTIVE community
 *     session. A bad/absent token fails the handshake — verified live: a fake
 *     token gets a non-101 response, so the path is real and the check works.
 *   - On connect the server sends `{"type":"connected","userId":...}`.
 *   - It answers `{"type":"ping"}` with `{"type":"pong"}`.
 *   - New messages arrive as `{"type":"message","conversationId":...,"message":{...}}`.
 *   - `CommunityChatWebSocketHandler.broadcastPayload` sends ONLY to sessions
 *     belonging to members of that conversation, so a client never receives
 *     traffic for a conversation it is not in.
 *
 * Sending still goes over REST; the socket is receive-only for message content.
 * That is the Legacy design and it is the right one — the REST call is what
 * persists, and the socket fans the result out to every device.
 *
 * Legacy bug fixed here: Legacy cleared `reconnectTimer` on close but never
 * reassigned it, so the cleanup `clearTimeout` referenced a timer id from a
 * previous generation and a reconnect could fire after unmount. The timer id is
 * tracked properly below, and every scheduled reconnect is cancelled on teardown.
 */

type ChatSocketPayload =
  | { type: "connected"; userId?: string }
  | { type: "pong" }
  | { type: "read"; conversationId: string; userId: string; sequenceNumber: number }
  | { type: "recall"; conversationId: string; message: ChatMessage }
  | { type: "message"; conversationId: string; message: ChatMessage };

/** Exported for tests — resolves the socket URL for the current environment. */
export function resolveChatSocketUrl(token: string): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  if (apiBase) {
    const url = new URL(apiBase);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws/community/chat";
    url.search = `token=${encodeURIComponent(token)}`;
    return url.toString();
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/community/chat?token=${encodeURIComponent(token)}`;
}

export type ChatSocketHandlers = {
  /**
   * The handshake succeeded and the server named our own community user id.
   *
   * This is the ONLY place the frontend can learn its own user id: `MeView` and
   * `ProfileView` both omit it (verified in the Java, 2026-09-27), while
   * `ChatMessageView.senderId` is a user id. Without this, "is this message
   * mine?" is unanswerable. See ConversationThreadPage.
   */
  onConnected?: (userId: string) => void;
  /** A new message arrived in any conversation the user belongs to. */
  onMessage?: (conversationId: string, message: ChatMessage) => void;
  /** Someone else advanced their read cursor. */
  onRead?: (conversationId: string, userId: string, sequenceNumber: number) => void;
  /** A message was recalled. */
  onRecall?: (conversationId: string, message: ChatMessage) => void;
};

const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;

/**
 * Subscribes to the community chat socket while `enabled`.
 *
 * `enabled` gates the whole connection: pass `isAuthenticated` so a signed-out
 * visitor never opens a socket that can only fail its handshake. Handlers may be
 * inline functions — they are read through a ref, so they do not retrigger the
 * effect, and only `enabled` reconnects.
 */
export function useCommunityChatSocket(enabled: boolean, handlers: ChatSocketHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const token = getStoredToken();
    if (!token) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function clearTimers() {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = undefined;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    }

    function connect() {
      if (disposed) return;
      socket = new WebSocket(resolveChatSocketUrl(token as string));

      socket.onopen = () => {
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        let payload: ChatSocketPayload;
        try {
          payload = JSON.parse(String(event.data)) as ChatSocketPayload;
        } catch {
          return; // ignore malformed frames
        }
        if (!payload || typeof payload !== "object") return;

        if (payload.type === "connected" && payload.userId) {
          handlersRef.current.onConnected?.(payload.userId);
        } else if (payload.type === "message" && payload.conversationId && payload.message) {
          handlersRef.current.onMessage?.(payload.conversationId, payload.message);
        } else if (payload.type === "read" && payload.conversationId) {
          handlersRef.current.onRead?.(
            payload.conversationId,
            payload.userId,
            payload.sequenceNumber,
          );
        } else if (payload.type === "recall" && payload.conversationId && payload.message) {
          handlersRef.current.onRecall?.(payload.conversationId, payload.message);
        }
      };

      socket.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = undefined;
        }
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimers();
      socket?.close();
    };
  }, [enabled]);
}
