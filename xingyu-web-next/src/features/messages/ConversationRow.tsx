import { Link } from "react-router-dom";
import type { Conversation } from "@/api/messages/messages.types";
import { conversationLabel } from "@/api/messages/messages.types";
import { cn } from "@/lib/cn";

/*
 * One row of the mailbox (Phase 2I-3).
 *
 * `lastMessage` is already a server-side preview — it arrives as plain text,
 * 「[图片]」, 「[文件] name」 or 「[消息已撤回]」. It is rendered verbatim and never
 * re-derived, because the server is the only side that knows a message's type
 * without loading it.
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
}: {
  conversation: Conversation;
  /** The conversation currently open in the thread pane. */
  active: boolean;
}) {
  const label = conversationLabel(conversation);
  const at = formatConversationTime(conversation.updatedAt);
  const unread = conversation.unreadCount ?? 0;
  const isGroup = conversation.type === "GROUP";

  return (
    <li>
      <Link
        to={`/messages/${encodeURIComponent(conversation.id)}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
          active ? "border-accent bg-accent/10" : "border-border bg-card hover:bg-muted",
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
                "truncate text-sm",
                unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground",
              )}
            >
              {label}
            </span>
            {isGroup ? (
              <span className="shrink-0 rounded border border-border px-1 text-[10px] text-muted-foreground">
                群聊
              </span>
            ) : null}
            {at ? (
              <time className="ml-auto shrink-0 text-xs text-muted-foreground">{at}</time>
            ) : null}
          </span>

          <span className="mt-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {conversation.lastMessage ?? "还没有消息"}
            </span>
            {unread > 0 ? (
              <span
                className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-4 text-accent-foreground"
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
