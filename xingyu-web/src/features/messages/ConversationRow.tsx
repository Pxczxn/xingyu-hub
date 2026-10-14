import { Link } from "react-router-dom";
import type { Conversation } from "@/api/messages/messages.types";
import { conversationLabel } from "@/api/messages/messages.types";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * One row of the mailbox (Phase 2I-3).
 *
 * `lastMessage` is already a server-side preview — it arrives as plain text,
 * 「[图片]」, 「[文件] name」 or 「[消息已撤回]」. It is rendered verbatim and never
 * re-derived, because the server is the only side that knows a message's type
 * without loading it.
 *
 * 2026-10-13 (batch 07c). The domain-wide surface rules live at the top of
 * MailboxPage.tsx. Three things are specific to this row:
 *
 *   1. THE ROW IS A CARD, SO IT TAKES THE CARD'S SURFACE. `rounded-xl` over
 *      `border-border/70` is the pair every other list row in the app uses, and
 *      this was the last `rounded-lg` + full-strength `border-border` row left in
 *      the feature — the kind of one-step difference nobody can name and everybody
 *      can see once the two are compared.
 *
 *   2. THE NAME IS A TITLE, NOT A SENTENCE. It was `text-sm`, the step a paragraph
 *      uses, while every other list row that names a thing — ContentCard,
 *      SearchPage, ProfileWorks, MySubmissionsPage — sets that name at
 *      `text-card`. The row's OTHER two lines stay at `text-meta`, and that gap is
 *      what makes the name read as a title.
 *
 *   3. THE TWO PILLS COME UP TO THE FLOOR. 「群聊」 and the unread count were both
 *      at 10px, one pixel under the 11px micro step that is this app's own floor
 *      (`.eyebrow`, and every other pill in the app). The count in particular is a
 *      number a reader has to take in at a glance, and 10px is where "at a glance"
 *      stops working.
 *
 * `aria-current="page"` and the unread `aria-label` are load-bearing — the
 * component tests query both by role — and the row is ONE <Link> on purpose: a
 * mailbox row is a single hit target, and a nested link inside it would both lie
 * about what the row does and break the tests' `getByRole("link")`.
 */

/** ISO instant -> 「MM/DD HH:mm」 in CST; a missing/odd value degrades to null. */
export function formatConversationTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

export function ConversationRow({
  conversation,
  active,
  index,
}: {
  conversation: Conversation;
  /** The conversation currently open in the thread pane. */
  active: boolean;
  /**
   * Position in the mailbox list, for the entrance stagger. Optional because the
   * row is also rendered on its own in the component tests, and a row that is not
   * in a list has no position to be staggered from — it still rises, it just does
   * not wait.
   */
  index?: number;
}) {
  const label = conversationLabel(conversation);
  const at = formatConversationTime(conversation.updatedAt);
  const unread = conversation.unreadCount ?? 0;
  const isGroup = conversation.type === "GROUP";

  return (
    <li
      className="animate-rise-in"
      style={index === undefined ? undefined : { animationDelay: staggerDelay(index) }}
    >
      <Link
        to={`/messages/${encodeURIComponent(conversation.id)}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "focus-ring flex items-start gap-3 rounded-xl border p-3 transition-colors",
          active ? "border-accent bg-accent/10" : "border-border/70 bg-card hover:bg-muted",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
            isGroup ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {label.slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-card",
                unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground",
              )}
            >
              {label}
            </span>
            {isGroup ? (
              <span className="shrink-0 rounded border border-border px-1 text-[11px] text-muted-foreground">
                群聊
              </span>
            ) : null}
            {at ? (
              <time className="ml-auto shrink-0 text-meta tabular-nums text-muted-foreground">
                {at}
              </time>
            ) : null}
          </span>

          <span className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
              {conversation.lastMessage ?? "还没有消息"}
            </span>
            {unread > 0 ? (
              <span
                className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-4 text-accent-foreground"
                aria-label={`${unread} 条未读`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}
