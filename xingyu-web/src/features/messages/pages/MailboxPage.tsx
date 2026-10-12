import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { PageState } from "@/components/shared/PageState";
import { useChatSocket } from "@/features/chat/chat-socket.context";
import { cn } from "@/lib/cn";
import { ConversationRow } from "../ConversationRow";
import { ConversationThreadPage } from "./ConversationThreadPage";
import { NewMessageComposer } from "../NewMessageComposer";

/*
 * The mailbox.
 *
 * Layout is master/detail: this page renders the conversation list, and
 * `ConversationThreadPage` renders the open conversation beside it. Both live
 * under /messages, so the list must NOT assume it is alone on the page — when a
 * conversation is open the list is the left column and the thread is the right.
 *
 * 2026-10-06: the list, its unread badges and the header badge now come from ONE
 * shared source — `ChatSocketProvider` — instead of this page fetching
 * `GET /messages` and holding a second WebSocket of its own. Two consequences:
 *   - the mailbox and the header can no longer disagree, because there is only one
 *     number and one list; a `message` / `read` frame refreshes both at once;
 *   - a failed refresh keeps the previous (server-derived) values, so the badge
 *     never silently drops to 0.
 *
 * `GET /api/v1/messages` is a BARE ARRAY and the mapper already sorts
 * `updated_at DESC`; the list is rendered in that order and never re-sorted.
 */

export function MailboxPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const { conversations, conversationsStatus, conversationsError, conversationsExpired } =
    useChatSocket();
  const threadOpen = Boolean(conversationId);

  if (conversationsStatus === "idle" || conversationsStatus === "loading") {
    return <PageState kind="loading" />;
  }

  if (conversationsStatus === "error" || conversations === null) {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            conversationsExpired
              ? "登录状态已过期，请重新登录。"
              : (conversationsError ?? "无法读取会话列表，请稍后重试。")
          }
        />
        {/* Only an expired session gets a login link. Telling a signed-in user to log in
            because a 500 happened is the kind of small lie that erodes trust in the
            whole error surface. */}
        {conversationsExpired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const items = conversations;

  return (
    <div className="section-gap">
      {/*
        Page header — MAILBOX responsibility only.

        On mobile the thread takes over the pane, so the big 「私信 / N 条未读 / 新建私信」
        header is hidden while a conversation is open: otherwise the reader sees the
        mailbox title and the conversation title stacked on top of each other.
        2026-10-06.
      */}
      {/*
        2026-10-06 — two cuts here, both from measured evidence:
          1. The 「N 条未读」 line is GONE. The number already appears on the header
             badge (account total) and on each row badge (per conversation); a third
             copy under the page title said the same thing a third time.
          2. 「搜索消息」 is a quiet text link next to 「新建私信」, not a toolbar of its
             own. It is an auxiliary tool and must not out-shout the conversation list
             or the conversation itself.
      */}
      <header
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
          threadOpen && "max-lg:hidden",
        )}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-primary">私信</h1>
        <div className="flex items-center gap-3">
          <Link
            to="/messages/search"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            <Search className="h-4 w-4" aria-hidden />
            搜索消息
          </Link>
          <NewMessageComposer />
        </div>
      </header>

      {/*
        Master / detail.
        ============================================================
        2026-10-06 (workspace): the two panes are now INDEPENDENT scroll areas at
        >= lg, and the thread is a flex column whose message viewport is the only
        thing that scrolls. Before this, the thread's auto-scroll used
        `bottomRef.scrollIntoView()`, which scrolls the DOCUMENT — measured: opening
        a conversation moved the page 345px, pushing the page header and the entire
        left column off screen.

        < lg stays one pane at a time: opening a conversation replaces the list (the
        thread's own 「返回会话列表」 is the way back), because a 390px viewport has no
        room for two columns.
      */}
      <div
        className={cn(
          "lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6",
          // Bounded desktop panes, each scrolling on its own.
          //
          // Two details are load-bearing, and both were measured as failures:
          //  - no `items-start`: it sizes the grid row by content, so a child's
          //    `h-full` resolves against an auto-height row and the pane grows with
          //    the conversation instead of scrolling;
          //  - `grid-rows-[minmax(0,1fr)]`: the row must itself be bounded, and
          //    `minmax(0,…)` (not `1fr`) is what lets it shrink below content.
          // Paired with `min-h-0` on both panes, this is the difference between
          // "the message list scrolls" and "the whole page scrolls".
          "lg:h-[calc(100vh-12rem)] lg:grid-rows-[minmax(0,1fr)]",
        )}
      >
        <div
          className={cn(
            "min-w-0 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-1",
            threadOpen && "max-lg:hidden",
          )}
        >
          {items.length === 0 ? (
            <PageState
              kind="empty"
              illustration={false}
              className="border-0 bg-transparent py-10"
              title="还没有私信"
              description="可以通过用户名发起新的对话。"
            />
          ) : (
            <ul aria-label="会话列表" className="flex list-none flex-col gap-2 p-0">
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

        <div className={cn("min-w-0 lg:h-full lg:min-h-0", !threadOpen && "hidden lg:block")}>
          {threadOpen ? (
            <ConversationThreadPage />
          ) : (
            /*
              2026-10-06: the 808×149 dashed placeholder box is gone. It read as a
              temporary skeleton sitting in a 540px pane, and it said nothing. The pane
              now carries the empty state itself — one quiet line, no illustration, no
              feature education, no suggested contacts.
            */
            <p className="grid h-full place-items-center px-6 text-center text-meta text-muted-foreground">
              选择一个会话开始聊天
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
