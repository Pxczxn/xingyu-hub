import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import {
  countUnreadConversations,
  type ChatMessage,
  type Conversation,
} from "@/api/messages/messages.types";
import { getStoredToken } from "@/lib/storage";
import {
  ChatSocketContext,
  type ChatEvent,
  type ChatSocketContextValue,
  type ConversationsStatus,
} from "./chat-socket.context";

/*
 * 全应用唯一一条社区 WebSocket（2026-10-06）。
 *
 * 三条不变量：
 *
 *  1. **一个 tab 一条连接。** 组件不再自己开 socket，全部经 {@link ChatSocketContext} 订阅。
 *     服务端现在也支持同一 userId 多条并存会话（多标签页 / 多设备），所以这条约束由前端
 *     自己保证 —— 不再依赖「服务端踢掉旧连接」这种会互相误伤的机制。
 *
 *  2. **重连必须对账。** socket 只负责实时推送，不重放离线消息。每次（重）连上后，用
 *     「本地已知最大 sequence」调 `GET /messages/{id}/messages/after` 补齐；补回来的消息
 *     以**普通 message 事件**派发，所以消费方的去重逻辑与实时路径完全一致。
 *
 *  3. **失败不伪造状态。** 会话列表拉取失败时保留旧值（角标不会假装归零）；socket 断开
 *     只影响 `connection` 状态，不影响任何已渲染内容。
 */

const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
/** 单次对账最多补多少条；不够就循环补到追平（有上限，避免异常情况下无限打接口）。 */
const BACKFILL_PAGE = 100;
const BACKFILL_MAX_ROUNDS = 5;

type SocketPayload =
  | { type: "connected"; userId?: string }
  | { type: "pong" }
  | { type: "read"; conversationId: string; userId: string; sequenceNumber: number }
  | { type: "recall"; conversationId: string; message: ChatMessage }
  | { type: "message"; conversationId: string; message: ChatMessage };

export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ChatSocketContextValue["connection"]>("idle");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [conversationsStatus, setConversationsStatus] = useState<ConversationsStatus>("idle");
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [conversationsExpired, setConversationsExpired] = useState(false);

  const handlersRef = useRef(new Set<(event: ChatEvent) => void>());
  /** 当前打开的会话 + 本地已知最大序号（由 thread 页面登记）。 */
  const watchRef = useRef<{ conversationId: string | null; knownMaxSequence: number }>({
    conversationId: null,
    knownMaxSequence: 0,
  });
  /** 对账进行中标记：避免 socket 与 REST 同时抵达时重复对账。 */
  const backfillingRef = useRef(false);

  const emit = useCallback((event: ChatEvent) => {
    for (const handler of handlersRef.current) {
      handler(event);
    }
  }, []);

  const subscribe = useCallback((handler: (event: ChatEvent) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // ---------------------------------------------------------------- 会话列表（未读唯一来源）

  const authenticatedRef = useRef(false);
  authenticatedRef.current = Boolean(getStoredToken());

  const refreshConversations = useCallback(async () => {
    if (!authenticatedRef.current) {
      setConversations([]);
      setConversationsStatus("ready");
      return;
    }
    setConversationsStatus((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const items = await messagesApi.listConversations();
      setConversations(items);
      setConversationsStatus("ready");
      setConversationsError(null);
      setConversationsExpired(false);
    } catch (err: unknown) {
      // 失败时**保留旧值**：角标宁可停在旧的服务端值，也不能变成 0（那等于谎称已读）。
      setConversationsStatus((current) => (current === "ready" ? "ready" : "error"));
      setConversationsError(err instanceof Error ? err.message : "无法读取会话列表");
      setConversationsExpired(
        err instanceof ApiError &&
          (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED"),
      );
    }
  }, []);

  useEffect(() => {
    if (!authenticatedRef.current) {
      setConversations([]);
      setConversationsStatus("ready");
      return;
    }
    void refreshConversations();
  }, [refreshConversations]);

  // 任何影响未读的事件都让会话列表重新对账（服务端仍是事实源，这里不自己算）。
  // - message：新消息 → lastMessage / unreadCount 变
  // - read：有人推进了已读游标（包含本 tab 自己的线程 markRead）→ unreadCount 变
  // 一次会话列表请求很轻（它是邮件箱本身），所以直接重取而不是本地打补丁：少一份会漂移的副本。
  useEffect(() => {
    if (!authenticatedRef.current) return;
    return subscribe((event) => {
      if (event.kind === "message" || event.kind === "read" || event.kind === "recall") {
        void refreshConversations();
      }
    });
  }, [subscribe, refreshConversations]);

  // ---------------------------------------------------------------- 重连对账

  const backfill = useCallback(async () => {
    const { conversationId, knownMaxSequence } = watchRef.current;
    if (!conversationId || backfillingRef.current) return;
    backfillingRef.current = true;
    try {
      let cursor = knownMaxSequence;
      for (let round = 0; round < BACKFILL_MAX_ROUNDS; round += 1) {
        const page = await messagesApi.listMessagesAfter(conversationId, cursor, BACKFILL_PAGE);
        if (page.messages.length === 0) return;
        for (const message of page.messages) {
          // 以普通 message 事件派发：消费方的按 id 去重逻辑同时服务于实时与对账两条路径。
          emit({ kind: "message", conversationId, message });
          cursor = Math.max(cursor, message.sequenceNumber);
        }
        if (!page.hasMore) return;
      }
    } catch {
      // 对账失败保持静默：页面已经渲染的内容仍然正确，下一次重连或用户操作会再试。
    } finally {
      backfillingRef.current = false;
    }
  }, [emit]);

  const watchConversation = useCallback(
    (conversationId: string | null, knownMaxSequence: number) => {
      const current = watchRef.current;
      if (
        current.conversationId === conversationId &&
        current.knownMaxSequence === knownMaxSequence
      ) {
        return;
      }
      watchRef.current = { conversationId, knownMaxSequence };
    },
    [],
  );

  // ---------------------------------------------------------------- 连接

  useEffect(() => {
    if (!authenticatedRef.current) return;
    const token = getStoredToken();
    if (!token) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let hasConnectedBefore = false;

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
      setConnection(hasConnectedBefore ? "reconnecting" : "connecting");
      const url = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        window.location.host
      }/ws/community/chat?token=${encodeURIComponent(token as string)}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        pingTimer = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        let payload: SocketPayload;
        try {
          payload = JSON.parse(String(event.data)) as SocketPayload;
        } catch {
          return;
        }
        if (!payload || typeof payload !== "object") return;

        if (payload.type === "connected") {
          hasConnectedBefore = true;
          setConnection("open");
          if (payload.userId) {
            setMyUserId(payload.userId);
            emit({ kind: "connected", userId: payload.userId });
          }
          // 每次（重）连上就对账：socket 不重放离线消息，缺口只能靠 REST 补。
          void backfill();
        } else if (payload.type === "message" && payload.conversationId && payload.message) {
          emit({
            kind: "message",
            conversationId: payload.conversationId,
            message: payload.message,
          });
        } else if (payload.type === "read" && payload.conversationId) {
          emit({
            kind: "read",
            conversationId: payload.conversationId,
            userId: payload.userId,
            sequenceNumber: payload.sequenceNumber,
          });
        } else if (payload.type === "recall" && payload.conversationId && payload.message) {
          emit({
            kind: "recall",
            conversationId: payload.conversationId,
            message: payload.message,
          });
        }
      };

      socket.onclose = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = undefined;
        }
        if (disposed) return;
        setConnection("reconnecting");
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;
      clearTimers();
      socket?.close();
    };
  }, [emit, backfill]);

  const value = useMemo<ChatSocketContextValue>(
    () => ({
      connection,
      myUserId,
      subscribe,
      conversations,
      conversationsStatus,
      conversationsError,
      conversationsExpired,
      unreadTotal: conversations ? countUnreadConversations(conversations) : null,
      refreshConversations,
      watchConversation,
    }),
    [
      connection,
      myUserId,
      subscribe,
      conversations,
      conversationsStatus,
      conversationsError,
      refreshConversations,
      watchConversation,
    ],
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}
