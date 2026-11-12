import { Link, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { SplitPane } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
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
 *
 * 2026-10-13 (batch 07c) — THE SURFACE RULES FOR THE WHOLE messages/ FEATURE.
 * ============================================================
 * Every file in this feature follows these three; the per-file comments below
 * only say what is specific to that file. A change that breaks one of them has
 * to argue for itself here first.
 *
 *   1. THE DOMAIN'S CARDS ARE THE APP'S CARDS: `rounded-xl` + `border-border/70`
 *      + `bg-card`. The mailbox is the one list in the app whose rows are
 *      SEPARATE cards in a `flex flex-col gap-2` flow instead of one card with
 *      `divide-y` — a row carries its own unread state and its own hover, and a
 *      divider between rows can express neither. That is the shape, not an
 *      oversight, so the `divide-y` recipe used by the events pages does NOT
 *      apply here.
 *
 *   2. PROSE IS `text-meta` (13px), MICRO-LABELS ARE `text-[11px]`, CONTROLS
 *      KEEP `text-sm`. Preview lines, timestamps, counters and attachment
 *      captions are prose; pills and badges are micro-labels; buttons, inputs
 *      and nav links are controls and stay at the size the rest of the app sets
 *      them. Nothing in this feature sits at 10px any more: 11px is this app's
 *      own floor (`.eyebrow`), and 10px is where a number a reader has to take
 *      in at a glance — an unread count — stops being glanceable.
 *
 *   3. ENTRANCE MOTION IS `animate-rise-in` + AN INLINE `staggerDelay(index)`,
 *      AND IT PLAYS ONCE PER MOUNT. The conversation list deliberately has NO
 *      `key=` replay: the socket pushes a frame on every message, and replaying
 *      the entire mailbox because someone typed a sentence is exactly the motion
 *      abuse this batch exists to avoid. Pages that switch between a fixed set
 *      of tabs DO replay via `key=` (see MyEventsPage) — there the switch is the
 *      reader's own act, so the motion answers something the reader just did.
 */

export function MailboxPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const {
    conversations,
    conversationsStatus,
    conversationsError,
    conversationsExpired,
    refreshConversations,
  } = useChatSocket();
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
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the read itself failed, so ask the provider
             to run it again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => void refreshConversations()}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const items = conversations;

  /*
   * SK4 收件箱 · H=壳 / D=紧 / R=错（A §3 的 /messages/* 域 Mailbox 行）。
   *
   * 骨架 = `SplitPane`，也就是 A §4 要求的「自 MailboxPage 抽出」的那一个：
   * `[320 列表 | 1fr 详情]` 定高、**页面自身不滚、两栏各自滚**。抽出后这里只剩
   * 两件事：左边是什么、右边是什么。三个被实测过的细节（不要 `items-start`、
   * 行是 `minmax(0,1fr)`、两栏都 `min-h-0`）现在只在 `SplitPane` 里写一次。
   *
   * H=壳（B 类壳，A §7.5：本页没有壳层 heading）：页内必须恰有 1 个 `<h1>`，
   * 这里用 `sr-only` —— 壳语义要的是「首屏第一块即内容」，而本页的内容是会话列表，
   * 不是一条标题横幅；可见的一行只留控件（搜索入口 + 新建私信）。
   *
   * D=紧：左边是行式会话卡（每行自带未读与 hover，所以是独立卡面而不是 `divide-y`），
   * 间距走 `--density-list-gap`，与 SavedMessages 的「松 + 瀑布流」区分。
   * R=错：主列 + 详情列，两栏定高各滚 —— 这是 SK4 与 SK1 唯一的区别（SK1 整页滚）。
   *
   * 移动端（<lg）一次只显示一栏：`mobileView` 由 `threadOpen` 决定，回来的路是
   * 会话自己的「返回会话列表」。
   */
  return (
    <div className="flex flex-col gap-4">
      {/* 页内唯一的 h1；放在 header 之外，这样移动端隐藏标题行时标题仍在无障碍树里。 */}
      <h1 className="sr-only">私信</h1>

      {/*
        Page toolbar — MAILBOX responsibility only.

        On mobile the thread takes over the pane, so the mailbox's own control row
        is hidden while a conversation is open: otherwise the reader sees the
        mailbox's controls above the conversation.
        2026-10-06: the 「N 条未读」 line is GONE (the header badge and each row
        badge already say it), and 「搜索消息」 is a quiet text link next to
        「新建私信」 rather than a toolbar of its own.
      */}
      <header
        className={cn(
          "flex items-center justify-end gap-3",
          threadOpen && "max-lg:hidden",
        )}
      >
        <Link
          to="/messages/search"
          className="focus-ring flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          <Search className="h-4 w-4" aria-hidden />
          搜索消息
        </Link>
        <NewMessageComposer />
      </header>

      <SplitPane
        listLabel="会话栏"
        detailLabel="会话内容"
        /*
         * A pane with nothing selected must never be an empty box: one quiet
         * statement, no illustration, no feature education, no suggested contacts.
         */
        detailEmpty={
          <p className="grid h-full place-items-center px-6 text-center text-meta text-muted-foreground">
            选择一个会话开始聊天
          </p>
        }
        mobileView={threadOpen ? "detail" : "list"}
        listWidth={320}
        list={
          items.length === 0 ? (
            <PageState
              kind="empty"
              illustration={false}
              className="border-0 bg-transparent py-10"
              title="还没有私信"
              description="可以通过用户名发起新的对话。"
            />
          ) : (
            <ul aria-label="会话列表" className="flex list-none flex-col gap-[var(--density-list-gap)] p-0">
              {items.map((conversation, index) => (
                <ConversationRow
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === conversationId}
                  index={index}
                />
              ))}
            </ul>
          )
        }
        detail={threadOpen ? <ConversationThreadPage /> : null}
      />
    </div>
  );
}
