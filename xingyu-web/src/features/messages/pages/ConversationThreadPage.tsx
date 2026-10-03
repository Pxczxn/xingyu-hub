import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import {
  conversationLabel,
  isRecalled,
  mergeMessages,
  newClientMessageId,
  sortBySequence,
  type ChatMessage,
  type Conversation,
} from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";
import { AttachmentPicker } from "../AttachmentPicker";
import { MessageBubble } from "../MessageBubble";

/*
 * One open conversation (Phase 2I-3).
 *
 * Data flow, and why it is shaped this way:
 *
 *  - The detail endpoints (`/messages/direct/{id}` and `/messages/group/{id}`)
 *    return the conversation WITH its newest message window, capped server-side
 *    at 100. So the first paint needs exactly one request and there is no
 *    "load messages" second round-trip.
 *  - Older history is paged with `GET /{id}/messages?cursor=`, whose cursor is
 *    the OLDEST sequence in the page it returns. It is only fetched on demand:
 *    the thread does not crawl backwards by itself.
 *  - The socket delivers messages for EVERY conversation the user is in, so each
 *    frame is filtered by `conversationId` here. Our own sent messages come back
 *    over the socket too, so the send path de-duplicates on the returned id
 *    rather than appending blindly — otherwise every message would render twice.
 *
 * Read receipts: opening a conversation and receiving a message while it is
 * open both mark it read. `markRead` with no sequence marks everything current,
 * which is what "I am looking at this" means.
 *
 * Recall: the UI only offers it for your own, un-recalled messages. The backend
 * is still the authority (403 not-yours, 409 past the window) and its error is
 * shown verbatim when it disagrees.
 *
 * Own-message detection. `ChatMessageView.senderId` is a community USER ID, but
 * neither `MeView` (/api/v1/me) nor `ProfileView` (/api/v1/me/profile) exposes
 * the caller's own id — verified in the Java on 2026-09-27. Comparing it against
 * `useAuth()`'s username would silently never match, which is worse than not
 * trying: it would label the user's own messages with their own sender name in
 * group threads and offer 撤回 on messages the backend will 403.
 *
 * The one authoritative source is the socket's `connected` frame, which the
 * handshake interceptor fills from the validated session (`communityUserId`).
 * So `myUserId` starts null and is filled in when the socket says hello. Until
 * then every bubble stays neutral (`mine === false`) and only messages that
 * already arrived after connect are known to be ours — the page never guesses.
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
  // Our own community user id, learned from the socket's `connected` frame.
  // Null until the socket is up — see the header comment for why nothing else
  // can supply it. `useAuth().user` is deliberately NOT consulted: it carries a
  // username, not an id.
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Load the conversation. GROUP and DIRECT have different detail endpoints even
  // though the payload is the same shape, and there is no "get by id" route that
  // works for both — so try DIRECT, then fall back to GROUP on 404.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setState({ kind: "loading" });
    setActionError(null);
    setDraft("");

    const load = async (): Promise<{ conversation: Conversation; isGroup: boolean }> => {
      try {
        return { conversation: await messagesApi.getDirect(conversationId), isGroup: false };
      } catch (err: unknown) {
        if (!isNotFound(err)) throw err;
        return { conversation: await messagesApi.getGroup(conversationId), isGroup: true };
      }
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
        void messagesApi.markRead(conversationId).catch(() => {
          /* a read receipt is not worth an error banner */
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: "error", expired: isAuthError(err), notFound: isNotFound(err) });
      });

    return () => {
      active = false;
    };
  }, [conversationId]);

  // Keep the newest message in view.
  useEffect(() => {
    if (state.kind !== "ready") return;
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [state]);

  useCommunityChatSocket(true, {
    onConnected: (userId) => setMyUserId(userId),
    onMessage: (incomingConversationId, message) => {
      if (incomingConversationId !== conversationId) return;
      setState((current) => {
        if (current.kind !== "ready") return current;
        // Our own message already arrived over the socket AND as the POST
        // response; mergeMessages de-duplicates by id, so this is safe either way.
        return { ...current, messages: mergeMessages(current.messages, [message]) };
      });
      // It is on screen, so it is read.
      void messagesApi.markRead(incomingConversationId).catch(() => {});
    },
    onRecall: (incomingConversationId, message) => {
      if (incomingConversationId !== conversationId) return;
      setState((current) =>
        current.kind === "ready"
          ? { ...current, messages: mergeMessages(current.messages, [message]) }
          : current,
      );
    },
    onRead: () => {
      // Someone else advanced their cursor. Nothing in this phase renders
      // per-member read state, so this is intentionally a no-op rather than a
      // silent guess at what it should change.
    },
  });

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
  // Known only once the socket says hello; until then we do not guess.
  const knownUserId = myUserId;

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="section-heading">{conversationLabel(conversation)}</h2>
          {isGroup ? (
            <span className="rounded border border-border px-1 text-[10px] text-muted-foreground">
              群聊
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
          {/* Phase 2I-3b: shared media and files for this conversation. Both are
              separate pages, not a drawer, so they are linkable and reloadable. */}
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

      <div className="flex flex-col gap-3">
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
          <PageState kind="empty" title="还没有消息" description="发送第一条消息开始对话吧。" />
        ) : (
          <ul aria-label="消息列表" className="flex flex-col gap-3">
            {messages.map((message) => {
              // Only meaningful once the socket has named us. Before that,
              // `knownUserId` is null and `mine` is false for everyone — a
              // neutral bubble, never a wrong one.
              const mine = knownUserId !== null && message.senderId === knownUserId;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={mine}
                  // In a group, name the sender unless it is us. With no id yet
                  // we cannot rule ourselves out, so we stay neutral and show no
                  // label rather than labelling the user's own message.
                  showSender={isGroup && knownUserId !== null && !mine}
                  canRecall={mine && !isRecalled(message)}
                  pending={Boolean(recalling[message.id])}
                  onRecall={(row) => void onRecall(row)}
                />
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <form onSubmit={onSend} className="flex items-end gap-2">
        <AttachmentPicker
          conversationId={conversation.id}
          conversationType={conversation.type}
          disabled={sending}
          onSent={(created) =>
            setState((current) =>
              current.kind === "ready"
                ? { ...current, messages: mergeMessages(current.messages, [created]) }
                : current,
            )
          }
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
    </div>
  );
}
