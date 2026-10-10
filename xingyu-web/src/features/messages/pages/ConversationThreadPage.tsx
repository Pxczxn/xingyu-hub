import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import {
  conversationLabel,
  mergeMessages,
  newClientMessageId,
  sortBySequence,
  shouldShowMessageTime,
  MESSAGE_LOCATOR_PARAM,
  MESSAGE_SEQUENCE_PARAM,
  type ChatMessage,
  type Conversation,
} from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useChatSocket } from "@/features/chat/chat-socket.context";
import { cn } from "@/lib/cn";
import { AttachmentPicker } from "../AttachmentPicker";
import { MessageBubble, isRecallable } from "../MessageBubble";

/*
 * One open conversation.
 *
 * 2026-10-06 — three things changed here, all from the Messages audit:
 *
 *  1. It no longer opens a WebSocket. It SUBSCRIBES to the single tab-wide connection
 *     (`useChatSocket`). It used to open its own with `enabled` hardcoded to `true`, which
 *     meant three sockets per tab (shell + mailbox + thread) fighting over the server's one
 *     session per user — measured 700+ connect/disconnect cycles in one audit session.
 *
 *  2. The message viewport scrolls on its own. Auto-scrolling used to call
 *     `bottomRef.scrollIntoView()`, which scrolls the DOCUMENT: measured, opening a
 *     conversation moved the page 345px and pushed the page header and the whole left
 *     column off screen. Now only the message list scrolls, and the composer stays put.
 *
 *  3. Read-state is reconciled against the server, not optimistically. Opening the thread
 *     marks everything current read, and each write refreshes the SHARED conversation list
 *     so the header badge and the mailbox row agree with the database.
 *
 * Data flow, and why it is shaped this way:
 *
 *  - The detail endpoints (`/messages/direct/{id}` and `/messages/group/{id}`) return the
 *    conversation WITH its newest message window, capped server-side at 100, so the first
 *    paint needs exactly one request.
 *  - Older history is paged with `GET /{id}/messages?cursor=`, fetched only on demand.
 *  - Our own sent messages come back over BOTH the POST response and the socket frame, so
 *    the send path de-duplicates on id rather than appending blindly (measured: 10 → 11
 *    bubbles, one occurrence).
 *  - After a (re)connect the provider backfills anything missed while we were away, using
 *    `GET /{id}/messages/after` with our known max sequence, and dispatches it as ordinary
 *    `message` events — so the same dedup path covers live and recovered messages.
 *
 * Own-message detection: `ChatMessageView.senderId` is a user id, and neither `/me` nor
 * `/me/profile` returns one. The only authoritative source is the socket's `connected`
 * frame, which the provider now owns. Until it arrives every bubble stays neutral — the
 * page never guesses.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; notFound: boolean }
  | {
      kind: "ready";
      conversation: Conversation;
      messages: ChatMessage[];
      nextCursor: string | null;
    };

const SEND_FAILED = "消息发送失败，请重试。";

/**
 * Which element is actually scrolling for this layout (2026-10-06)?
 *
 * Exported so the rule is testable on its own — jsdom has no layout, so an inline
 * decision inside a component could only be "tested" by asserting nothing.
 *
 * The rule is a LAYOUT fact, never a user-agent check: if the message viewport
 * overflows, it is its own scroller (that is the >= lg case, where scrolling the
 * document is the bug we fixed — it dragged the page header and the left column
 * away). Below lg the thread sits in normal flow, the viewport does NOT overflow,
 * and the document is what scrolls — scrolling "the viewport" there is a no-op, which
 * left a 28-message thread opening on the oldest message with the composer 1392px
 * below the fold.
 */
export function scrollStrategyOf(viewport: {
  scrollHeight: number;
  clientHeight: number;
}): "viewport" | "document" {
  return viewport.scrollHeight > viewport.clientHeight + 1 ? "viewport" : "document";
}

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.problem.status === 404;
}

export function ConversationThreadPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [recalling, setRecalling] = useState<Record<string, boolean>>({});

  const { myUserId, subscribe, watchConversation, connection, refreshConversations } = useChatSocket();
  const [searchParams] = useSearchParams();
  /** The scrolling element for the message list — never the document. */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  /** Bottom sentinel: used by the mobile scroll strategy and as a scroll anchor. */
  const bottomRef = useRef<HTMLDivElement | null>(null);
  /** Only auto-scroll when the reader is already at the bottom (don't yank them down). */
  const stickToBottomRef = useRef(true);
  /** Where we were on the page before the thread scrolled it (restored on the way out). */
  const entryScrollRef = useRef(0);
  /**
   * Where we arrived from a search result: the message id (stable locator) plus its
   * sequence (so the window can be fetched in ONE request — never paged back until we
   * hit it). `null` when the thread was opened normally.
   */
  const [locator, setLocator] = useState<{ id: string; sequence: number } | null>(null);

  // Load the conversation. GROUP and DIRECT have different detail endpoints even
  // though the payload is the same shape, and there is no "get by id" route that
  // works for both — so try DIRECT, then fall back to GROUP on 404.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setState({ kind: "loading" });
    setActionError(null);
    setDraft("");
    // 记住进来之前页面在哪，离开时还原 —— 移动端我们可能要滚文档（见 scrollToLatest），
    // 走的时候不能把列表页留在一个莫名其妙的位置。
    entryScrollRef.current = typeof window === "undefined" ? 0 : window.scrollY;
    // 搜索落点：?m=<messageId>&s=<sequence>。id 是稳定标识，sequence 用来一次取回窗口。
    const locatorId = searchParams.get(MESSAGE_LOCATOR_PARAM);
    const locatorSequence = Number(searchParams.get(MESSAGE_SEQUENCE_PARAM));
    setLocator(
      locatorId && Number.isFinite(locatorSequence) && locatorSequence > 0
        ? { id: locatorId, sequence: locatorSequence }
        : null,
    );

    const load = async (): Promise<{ conversation: Conversation; isGroup: boolean }> => {
      try {
        return { conversation: await messagesApi.getDirect(conversationId), isGroup: false };
      } catch (err: unknown) {
        if (!isNotFound(err)) throw err;
        return { conversation: await messagesApi.getGroup(conversationId), isGroup: true };
      }
    };

    /**
     * Mark the conversation read, then re-read the shared list.
     *
     * The refresh is the point: the server is the source of truth for unread, and the
     * header badge + mailbox row read the same shared list. Relying on the socket's own
     * `read` frame instead would leave both stale whenever the socket is down — which is
     * exactly the case that made them drift before.
     */
    const markReadAndReconcile = async () => {
      try {
        await messagesApi.markRead(conversationId);
      } catch {
        // A read receipt is not worth an error banner; the next open will retry.
      }
      await refreshConversations();
    };

    load()
      .then(({ conversation }) => {
        if (!active) return;
        setState({
          kind: "ready",
          conversation,
          messages: sortBySequence(conversation.messages ?? []),
          nextCursor: null,
        });
        // Opening the thread means "I have seen this".
        void markReadAndReconcile();
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: "error", expired: isAuthError(err), notFound: isNotFound(err) });
      });

    return () => {
      active = false;
    };
    // refreshConversations is stable (useCallback with no deps) — re-running on it
    // would refetch the thread on every list refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  /*
   * Search landing (2026-10-06).
   *
   * The result link carries the target message id. If that message is not in the window
   * we hold (it can be far older than the newest 100), fetch ONE window around its
   * sequence — never "page backwards until we hit it", which in a long thread is dozens
   * of requests. Then scroll it into the message viewport and mark it with a static ring.
   */
  useEffect(() => {
    if (state.kind !== "ready" || !locator || !conversationId) return;
    if (!state.messages.some((message) => message.id === locator.id)) return;
    const viewport = viewportRef.current;
    const row = document.querySelector(`[data-message-id="${CSS.escape(locator.id)}"]`);
    if (!row) return;
    stickToBottomRef.current = false;
    // 落点滚动也遵守同一套策略：消息区在滚就只滚它（`scrollIntoView` 会连带把 document
    // 一起挪，实测在 1440 上仍会移动 54px）；消息区不在滚才让文档动。
    if (viewport && scrollStrategyOf(viewport) === "viewport") {
      const rowTop = row.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
      viewport.scrollTop = rowTop - (viewport.clientHeight - row.getBoundingClientRect().height) / 2;
      return;
    }
    row.scrollIntoView({ block: "center" });
  }, [state, locator, conversationId]);

  useEffect(() => {
    if (state.kind !== "ready" || !locator || !conversationId) return;
    if (state.messages.some((message) => message.id === locator.id)) return;
    let active = true;
    setActionError(null);
    messagesApi
      .listMessagesAround(conversationId, locator.sequence, 30)
      .then((context) => {
        if (!active) return;
        if (!context.found) {
          // 目标已不在库里（例如被删）。说清楚，而不是让用户对着一屏相似的消息猜。
          setActionError("这条消息已不在该会话中，可能已被删除。");
          return;
        }
        stickToBottomRef.current = false;
        setState((current) =>
          current.kind === "ready"
            ? { ...current, messages: mergeMessages(current.messages, context.messages) }
            : current,
        );
      })
      .catch(() => {
        if (active) setActionError("无法定位到这条消息，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, [state, locator, conversationId]);

  /*
   * Tell the provider which conversation is open and how far we have got, so a
   * (re)connect can backfill exactly the messages we are missing.
   */
  const knownMaxSequence =
    state.kind === "ready" && state.messages.length > 0
      ? state.messages[state.messages.length - 1].sequenceNumber
      : 0;
  useEffect(() => {
    watchConversation(conversationId ?? null, knownMaxSequence);
  }, [watchConversation, conversationId, knownMaxSequence]);

  // Live messages, recalls and read advances for THIS conversation.
  useEffect(() => {
    if (!conversationId) return;
    return subscribe((event) => {
      if (event.kind === "connected" || event.kind === "recall") {
        if (event.kind === "recall" && event.conversationId !== conversationId) return;
      }
      if (
        (event.kind === "message" || event.kind === "read" || event.kind === "recall") &&
        event.conversationId !== conversationId
      ) {
        return;
      }
      if (event.kind === "message") {
        setState((current) => {
          if (current.kind !== "ready") return current;
          // Our own message arrives over the socket AND as the POST response;
          // mergeMessages de-duplicates by id, so this is safe either way.
          return { ...current, messages: mergeMessages(current.messages, [event.message]) };
        });
        // It is on screen, so it is read. Reconcile the shared list so the badge and
        // the row agree with the server.
        void messagesApi
          .markRead(conversationId)
          .then(() => refreshConversations())
          .catch(() => {});
        return;
      }
      if (event.kind === "recall") {
        setState((current) =>
          current.kind === "ready"
            ? { ...current, messages: mergeMessages(current.messages, [event.message]) }
            : current,
        );
      }
      // `read`: someone else advanced their cursor. Nothing renders per-member read
      // state yet, so this stays a no-op rather than a silent guess.
    });
  }, [conversationId, subscribe, refreshConversations]);

  /**
   * Keep the newest message in view — and do it in the scroller that is actually
   * scrolling.
   *
   * WHY TWO STRATEGIES (2026-10-06, this is a fix for a regression):
   *   - at >= lg the message viewport is its own scroller (the panes are height-bounded),
   *     so scrolling the DOCUMENT is exactly the bug we just fixed: it dragged the page
   *     header and the whole left column off screen (measured 345px).
   *   - below lg the thread is in normal document flow — the message area does NOT
   *     scroll (measured: scrollHeight == clientHeight) and the composer sits at the end
   *     of the page. Scrolling "the viewport" there is a no-op, which left a 28-message
   *     thread opening on the OLDEST message with the composer 1392px below the fold.
   *
   * So the decision is made from a LAYOUT fact, not from the user agent: if the viewport
   * overflows, it is the scroller; otherwise the document is. That is why there is no
   * unconditional `scrollIntoView()` here any more.
   */
  const scrollToLatest = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (scrollStrategyOf(viewport) === "viewport") {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    // 文档流：把底部哨兵滚进视口。只用 scrollTo（瞬时），不用 smooth —— 那是 Motion。
    const sentinel = bottomRef.current;
    if (!sentinel || typeof window === "undefined") return;
    const delta = sentinel.getBoundingClientRect().bottom - window.innerHeight;
    if (delta > 0) window.scrollBy(0, delta);
  }, []);

  useEffect(() => {
    if (state.kind !== "ready") return;
    if (!stickToBottomRef.current) return;
    scrollToLatest();
  }, [state, scrollToLatest]);

  /**
   * Leaving the thread: put the page back where it was.
   *
   * On mobile we may have scrolled the document to reach the newest message; without
   * this the mailbox would come back with a scroll position that belongs to no list.
   */
  useEffect(
    () => () => {
      if (typeof window === "undefined") return;
      if (window.scrollY !== entryScrollRef.current) {
        window.scrollTo(0, entryScrollRef.current);
      }
    },
    [],
  );

  const onViewportScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // 视口不在滚（移动端）时，文档才是滚动的对象，就看文档。
    const distance =
      scrollStrategyOf(viewport) === "viewport"
        ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
    stickToBottomRef.current = distance < 48;
  }, []);

  async function onSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || state.kind !== "ready") return;

    const conversation = state.conversation;
    const clientMessageId = newClientMessageId();
    setSending(true);
    setActionError(null);

    try {
      const send = conversation.type === "GROUP" ? messagesApi.sendGroup : messagesApi.sendDirect;
      const created = await send(conversation.id, { body, clientMessageId });
      // The socket may have beaten us here; mergeMessages keeps one copy.
      setState((current) =>
        current.kind === "ready"
          ? { ...current, messages: mergeMessages(current.messages, [created]) }
          : current,
      );
      setDraft("");
      // lastMessage / updatedAt moved server-side; the shared list must follow.
      void refreshConversations();
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError && err.problem.detail ? err.problem.detail : SEND_FAILED,
      );
    } finally {
      setSending(false);
    }
  }

  async function onLoadOlder() {
    if (state.kind !== "ready" || loadingOlder) return;
    const oldest = state.messages[0]?.sequenceNumber;
    setLoadingOlder(true);
    setActionError(null);
    try {
      const page = await messagesApi.listMessages(state.conversation.id, {
        cursor: oldest === undefined ? null : String(oldest),
        limit: 50,
      });
      setState((current) =>
        current.kind === "ready"
          ? {
              ...current,
              messages: mergeMessages(current.messages, page.messages),
              nextCursor: page.nextCursor,
            }
          : current,
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof ApiError ? err.problem.detail : "无法加载更早的消息，请稍后重试。",
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  async function onRecall(message: ChatMessage) {
    if (state.kind !== "ready" || recalling[message.id]) return;
    setActionError(null);
    setRecalling((map) => ({ ...map, [message.id]: true }));
    try {
      const updated = await messagesApi.recallMessage(state.conversation.id, message.id);
      setState((current) =>
        current.kind === "ready"
          ? { ...current, messages: mergeMessages(current.messages, [updated]) }
          : current,
      );
      void refreshConversations();
    } catch (err: unknown) {
      // The backend is the authority on the recall window; show its reason.
      setActionError(err instanceof ApiError ? err.problem.detail : "撤回失败，请稍后重试。");
    } finally {
      setRecalling((map) => {
        const next = { ...map };
        delete next[message.id];
        return next;
      });
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={state.notFound ? "会话不存在" : "加载失败"}
          description={
            state.notFound
              ? "这个会话不存在，或者你不在其中。"
              : state.expired
                ? "登录状态已过期，请重新登录。"
                : "无法读取这个会话，请稍后重试。"
          }
        />
        <p className="text-center">
          {state.expired ? (
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          ) : (
            <Link to="/messages" className="text-sm text-accent hover:underline">
              返回会话列表
            </Link>
          )}
        </p>
      </div>
    );
  }

  const { conversation, messages } = state;
  const isGroup = conversation.type === "GROUP";
  // Known only once the socket has said hello; until then we do not guess.
  const knownUserId = myUserId;

  return (
    // The thread is a COLUMN: header (fixed) / message viewport (the only scroller) /
    // composer (fixed). `min-h-0` on the middle is what actually lets it shrink
    // instead of pushing the page taller.
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="section-heading">{conversationLabel(conversation)}</h2>
          {isGroup ? (
            <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">
              群聊
            </span>
          ) : null}
          {/*
            Connection state. Before 2026-10-06 there was NO signal at all: a dropped
            socket looked exactly like a quiet conversation, which is how "real-time"
            silently degraded into "refresh to see it".
          */}
          {connection === "reconnecting" ? (
            <span className="text-[11px] text-muted-foreground" role="status">
              连接中断，正在重连…
            </span>
          ) : null}
        </div>
        {isGroup && conversation.announcement ? (
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            群公告：{conversation.announcement}
          </p>
        ) : null}
        <nav className="flex items-center gap-3 text-sm">
          <Link to="/messages" className="text-accent hover:underline lg:hidden">
            返回会话列表
          </Link>
          <Link
            to={`/messages/${encodeURIComponent(conversation.id)}/media`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            图片
          </Link>
          <Link
            to={`/messages/${encodeURIComponent(conversation.id)}/files`}
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            文件
          </Link>
        </nav>
      </header>

      <div
        ref={viewportRef}
        onScroll={onViewportScroll}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto",
          "lg:overscroll-contain",
        )}
      >
        {messages.length > 0 ? (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingOlder}
              onClick={() => void onLoadOlder()}
            >
              {loadingOlder ? "加载中…" : "加载更早的消息"}
            </Button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <PageState
            kind="empty"
            illustration={false}
            className="border-0 bg-transparent py-10"
            title="还没有消息"
            description="发送第一条消息开始对话吧。"
          />
        ) : (
          <ul aria-label="消息列表" className="flex flex-col gap-3">
            {messages.map((message, index) => {
              // Only meaningful once the socket has named us. Before that,
              // `knownUserId` is null and `mine` is false for everyone — a
              // neutral bubble, never a wrong one.
              const mine = knownUserId !== null && message.senderId === knownUserId;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  conversationId={conversation.id}
                  mine={mine}
                  // In a group, name the sender unless it is us. With no id yet
                  // we cannot rule ourselves out, so we stay neutral.
                  showSender={isGroup && knownUserId !== null && !mine}
                  // 2026-10-06: only when the minute changes within a run of
                  // consecutive messages — otherwise a screen of six messages from
                  // the same minute rendered six identical timestamps.
                  showTime={shouldShowMessageTime(message, messages[index - 1])}
                  // The window is the server's, so it decides whether the recall
                  // window is still open (2026-10-06).
                  canRecall={mine && isRecallable(message)}
                  highlighted={locator?.id === message.id}
                  rowId={message.id}
                  pending={Boolean(recalling[message.id])}
                  onRecall={(row) => void onRecall(row)}
                />
              );
            })}
          </ul>
        )}
      </div>

      {actionError ? (
        <p role="alert" className="shrink-0 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <form onSubmit={onSend} className="flex shrink-0 items-end gap-2">
        <AttachmentPicker
          conversationId={conversation.id}
          conversationType={conversation.type}
          disabled={sending}
          onSent={(created) => {
            setState((current) =>
              current.kind === "ready"
                ? { ...current, messages: mergeMessages(current.messages, [created]) }
                : current,
            );
            void refreshConversations();
          }}
          onError={(reason) => setActionError(reason)}
        />
        <textarea
          value={draft}
          aria-label="消息内容"
          placeholder="输入消息…"
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          className="min-h-11 flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" variant="accent" disabled={sending || !draft.trim()}>
          {sending ? "发送中…" : "发送"}
        </Button>
      </form>

      {/*
        底部哨兵：放在**整个 thread 的末尾**（含 composer），不是消息区末尾。
        消息区在 <lg 不是滚动容器，此时「滚到最新」= 把这个哨兵滚进视口；只滚消息区末尾的话，
        composer 仍然落在折叠线以下（实测 390 上差 12px）。
      */}
      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
