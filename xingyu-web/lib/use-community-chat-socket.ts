"use client";

import { useEffect, useRef } from "react";
import { getStoredToken } from "@/lib/api-client";
import type { ChatMessage } from "@/lib/community-api";

type ChatSocketPayload =
  | { type: "connected"; userId?: string }
  | { type: "pong" }
  | { type: "message"; conversationId: string; message: ChatMessage };

function resolveWebSocketUrl(token: string) {
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

/**
 * 社区聊天 WebSocket：收到新消息后回调；HTTP 发送仍走 REST，服务端推送多端同步。
 */
export function useCommunityChatSocket(onMessage: (conversationId: string, message: ChatMessage) => void) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;

    let closed = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (closed) return;
      socket = new WebSocket(resolveWebSocketUrl(token));

      socket.onopen = () => {
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as ChatSocketPayload;
          if (payload.type === "message" && payload.conversationId && payload.message) {
            handlerRef.current(payload.conversationId, payload.message);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (pingTimer) clearInterval(pingTimer);
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3_000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
}
