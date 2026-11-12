import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import {
  countUnreadConversations,
  type ChatMessage,
  type Conversation,
} from "@/api/messages/messages.types";
import { getStoredToken, onAuthChanged, TOKEN_KEY } from "@/lib/storage";
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
 *  1. **一个 tab 一条连接，并且跟着当前 token。** 登录、退出、换号都会拆掉旧连接。
 *     无 token 时不连接。组件不再自己开 socket，全部经 {@link ChatSocketContext} 订阅。
 *
 *  2. **重连必须对账。** socket 只负责实时推送，不重放离线消息。每次（重）连上后，用
 *     「本地已知最大 sequence」调 `GET /messages/{id}/messages/after`，一直翻到服务端
 *     报告没有更新的消息。补回来的消息以**普通 message 事件**派发。
 *
 *  3. **失败不伪造状态。** 会话列表拉取失败时保留旧值（角标不会假装归零）。补齐失败时
 *     `backfill` 停在 `behind`，不能因为握手已经成功就把缺口当成已经追平。
 */

const PING_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 3_000;
const BACKFILL_PAGE = 100;

type SocketPayload =
  | { type: "connected"; userId?: string }
  | { type: "pong" }
  | { type: "read"; conversationId: string; userId: string; sequenceNumber: number }
  | { type: "recall"; conversationId: string; message: ChatMessage }
  | { type: "message"; conversationId: string; message: ChatMessage };

export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(() => getStoredToken());
  const [connection, setConnection] = useState<ChatSocketContextValue["connection"]>("idle");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [conversationsStatus, setConversationsStatus] = useState<ConversationsStatus>("idle");
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [conversationsExpired, setConversationsExpired] = useState(false);
  const [backfill, setBackfill] = useState<ChatSocketContextValue["backfill"]>("idle");

  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;
  /** Bumped when the socket effect starts and when it is torn down, so an in-flight backfill cannot publish into the next session. */
  const socketGenerationRef = useRef(0);

  const handlersRef = useRef(new Set<(event: ChatEvent) => void>());
  /** 当前打开的会话 + 本地已知最大序号（由 thread 页面登记）。 */
  const watchRef = useRef<{ conversationId: string | null; knownMaxSequence: number }>({
    conversationId: null,
    knownMaxSequence: 0,
  });
  /** 对账进行中标记：避免 socket 与 REST 同时抵达时重复对账。 */
  const backfillingRef = useRef(false);
  const backfillAgainRef = useRef(false);
  const backfillRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef<() => Promise<void>>(async () => {});

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

  useEffect(() => {
    const sync = () => setSessionToken(getStoredToken());
    const unsubscribe = onAuthChanged(sync);
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY || event.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const clearBackfillRetry = useCallback(() => {
    if (backfillRetryRef.current) {
      clearTimeout(backfillRetryRef.current);
      backfillRetryRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------- 会话列表（未读唯一来源）

  const refreshConversations = useCallback(async () => {
    const expected = sessionTokenRef.current;
    if (!expected) {
      setConversations([]);
      setConversationsStatus("ready");
      setConversationsError(null);
      setConversationsExpired(false);
      return;
    }
    setConversationsStatus((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const items = await messagesApi.listConversations();
      if (sessionTokenRef.current !== expected) return;
      setConversations(items);
      setConversationsStatus("ready");
      setConversationsError(null);
      setConversationsExpired(false);
    } catch (err: unknown) {
      if (sessionTokenRef.current !== expected) return;
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
    if (!sessionToken) return;
    void refreshConversations();
  }, [refreshConversations, sessionToken]);

  // 任何影响未读的事件都让会话列表重新对账（服务端仍是事实源，这里不自己算）。
  // 订阅本身不看登录态：游客先打开页面再登录时，这条效果不会重跑，所以必须一直订着，
  // 由 refresh 自己丢掉不属于当前 token 的结果。
  useEffect(() => {
    return subscribe((event) => {
      if (!sessionTokenRef.current) return;
      if (event.kind === "message" || event.kind === "read" || event.kind === "recall") {
        void refreshConversations();
      }
    });
  }, [subscribe, refreshConversations]);

  // ---------------------------------------------------------------- 重连对账

  const runBackfill = useCallback(async () => {
    const tokenAtStart = sessionTokenRef.current;
    const generationAtStart = socketGenerationRef.current;
    const { conversationId, knownMaxSequence } = watchRef.current;
    const stillThisSession = () =>
      sessionTokenRef.current === tokenAtStart && socketGenerationRef.current === generationAtStart;

    if (!tokenAtStart || !conversationId) return;
    if (backfillingRef.current) {
      backfillAgainRef.current = true;
      return;
    }
    backfillingRef.current = true;
    const scheduleRetry = () => {
      if (!stillThisSession() || backfillRetryRef.current) return;
      backfillRetryRef.current = setTimeout(() => {
        backfillRetryRef.current = null;
        if (!stillThisSession()) return;
        void backfillRef.current();
      }, RECONNECT_DELAY_MS);
    };
    try {
      let cursor = knownMaxSequence;
      for (;;) {
        if (!stillThisSession() || watchRef.current.conversationId !== conversationId) return;
        const page = await messagesApi.listMessagesAfter(conversationId, cursor, BACKFILL_PAGE);
        if (!stillThisSession() || watchRef.current.conversationId !== conversationId) return;
        if (page.messages.length === 0) {
          if (page.hasMore) {
            setBackfill("behind");
            scheduleRetry();
          } else {
            setBackfill("caught-up");
          }
          return;
        }
        let advanced = false;
        for (const message of page.messages) {
          emit({ kind: "message", conversationId, message });
          if (message.sequenceNumber > cursor) {
            cursor = message.sequenceNumber;
            advanced = true;
          }
        }
        if (watchRef.current.conversationId === conversationId) {
          watchRef.current = {
            conversationId,
            knownMaxSequence: Math.max(watchRef.current.knownMaxSequence, cursor),
          };
        }
        if (!page.hasMore) {
          setBackfill("caught-up");
          return;
        }
        if (!advanced) {
          setBackfill("behind");
          scheduleRetry();
          return;
        }
      }
    } catch {
      if (!stillThisSession()) return;
      setBackfill("behind");
      scheduleRetry();
    } finally {
      backfillingRef.current = false;
      if (backfillAgainRef.current) {
        backfillAgainRef.current = false;
        if (stillThisSession()) void backfillRef.current();
      }
    }
  }, [emit]);

  useEffect(() => {
    backfillRef.current = runBackfill;
  }, [runBackfill]);

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
    if (!sessionToken) {
      socketGenerationRef.current += 1;
      clearBackfillRetry();
      setConnection("idle");
      setMyUserId(null);
      setBackfill("idle");
      setConversations([]);
      setConversationsStatus("ready");
      setConversationsError(null);
      setConversationsExpired(false);
      return;
    }

    const generation = ++socketGenerationRef.current;
    const token = sessionToken;
    // Drop the previous account's identity and mailbox before the new handshake.
    // A failed refresh must not keep showing that other account's rows.
    setMyUserId(null);
    setBackfill("idle");
    setConversations(null);
    setConversationsStatus("loading");
    setConversationsError(null);
    setConversationsExpired(false);
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
      }/ws/community/chat?token=${encodeURIComponent(token)}`;
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
        if (disposed || socketGenerationRef.current !== generation) return;

        if (payload.type === "connected") {
          hasConnectedBefore = true;
          setConnection("open");
          if (payload.userId) {
            setMyUserId(payload.userId);
            emit({ kind: "connected", userId: payload.userId });
          }
          void backfillRef.current();
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
      if (socketGenerationRef.current === generation) socketGenerationRef.current += 1;
      clearTimers();
      clearBackfillRetry();
      socket?.close();
    };
  }, [clearBackfillRetry, emit, sessionToken]);

  const value = useMemo<ChatSocketContextValue>(
    () => ({
      connection,
      myUserId,
      subscribe,
      conversations,
      conversationsStatus,
      conversationsError,
      conversationsExpired,
      backfill,
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
      conversationsExpired,
      backfill,
      refreshConversations,
      watchConversation,
    ],
  );

  return <ChatSocketContext.Provider value={value}>{children}</ChatSocketContext.Provider>;
}
