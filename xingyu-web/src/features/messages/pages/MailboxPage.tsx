import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { messagesApi } from "@/api/messages/messages.api";
import {
  countUnreadConversations,
  toConversations,
  type Conversation,
} from "@/api/messages/messages.types";
import { PageState } from "@/components/shared/PageState";
import { useCommunityChatSocket } from "@/lib/use-community-chat-socket";
import { cn } from "@/lib/cn";
import { ConversationRow } from "../ConversationRow";
import { NewMessageComposer } from "../NewMessageComposer";

/*
 * The mailbox (Phase 2I-3).
 *
 * Layout is master/detail: this page renders the conversation list, and
 * `ConversationThreadPage` renders the open conversation beside it. Both live
 * under /messages, so the list must NOT assume it is alone on the page — when a
 * conversation is open the list is the left column and the thread is the right.
 *
 * `GET /api/v1/messages` is a BARE ARRAY and the mapper already sorts
 * `updated_at DESC`. The list is rendered in that order and never re-sorted:
 * `updatedAt` is nullable for a brand-new conversation, and a client sort would
 * put those rows somewhere arbitrary.
 *
 * Realtime: a new message on the socket bumps the list, because the row's
 * preview and unread count both change without the user doing anything. Rather
 * than patch the summary in place (the socket frame carries a message, not a
 * conversation), the list is refetched — the mailbox is small and this keeps one
 * source of truth for `lastMessage` / `unreadCount`.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean }
  | { kind: "ready"; items: Conversation[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function MailboxPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    // Only show the full-page spinner on the first load; a socket-driven refresh
    // must not blank a list the user is already reading.
    setState((current) => (current.kind === "ready" ? current : { kind: "loading" }));

    messagesApi
      .listConversations()
      .then((items) => {
        if (active) setState({ kind: "ready", items: toConversations(items) });
      })
      .catch((err: unknown) => {
        if (active) setState({ kind: "error", expired: isAuthError(err) });
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  // Live refresh on any incoming message. No read/recall handling here — those
  // only affect an open thread, which listens for itself.
  useCommunityChatSocket(true, {
    onMessage: () => setReloadToken((token) => token + 1),
  });

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired ? "登录状态已过期，请重新登录。" : "无法读取会话列表，请稍后重试。"
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const { items } = state;
  const unreadTotal = countUnreadConversations(items);
  const threadOpen = Boolean(conversationId);

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">私信</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadTotal > 0 ? `${unreadTotal} 条未读` : "没有未读消息"}
          </p>
        </div>
        <NewMessageComposer />
      </header>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有会话"
          description="在别人的主页点「私信」，或从上方新建一条私信，会话会出现在这里。"
        />
      ) : (
        <ul
          aria-label="会话列表"
          className={cn("flex flex-col gap-2", threadOpen && "lg:max-w-sm")}
        >
          {items.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === conversationId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
