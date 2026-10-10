import { Bell, Heart, MessageCircle, Megaphone, UserPlus, type LucideIcon } from "lucide-react";
import type { Notification } from "@/api/notifications/notifications.types";
import { cn } from "@/lib/cn";

/*
 * One notification row.
 *
 * 2026-10-06 (contract recovery): the row is now a SINGLE line — 谁 · 做了什么 · 时间.
 *
 *   - The backend's `title` is the whole sentence ("小明 关注了你"). FOLLOW no longer
 *     writes a `body` that restated it, so there is no second line to render.
 *   - The category tag was dropped from the row. It repeated the action the title
 *     already states ("关注了你" + "关注"), and with a single real producer the icon
 *     (UserPlus) already carries the type. It also cost a whole line of vertical space
 *     per row for one two-character word.
 *   - `body` is still rendered when present, because the column exists and a future
 *     producer may legitimately need a second line; it just is not assumed.
 *
 * Two things this deliberately does NOT do:
 *
 *  1. It does not invent a destination. The page resolves it from the structured
 *     `actor` (see notificationHref) and passes `href` in. When there is no safe
 *     destination the row renders as plain text rather than a link that leads nowhere.
 *  2. It does not render a per-row 「标为已读」 button. Clicking the row is the
 *     action — matching Legacy, and keeping the list free of a control that repeats
 *     on every line.
 */

const ICONS: Record<string, LucideIcon> = {
  LIKE: Heart,
  REACTION: Heart,
  COMMENT: MessageCircle,
  REPLY: MessageCircle,
  FOLLOW: UserPlus,
  MENTION: MessageCircle,
  SYSTEM: Megaphone,
  ANNOUNCE: Megaphone,
};

/** Never throws on an unknown category — falls back to the bell. */
export function notificationIcon(category: string | null | undefined): LucideIcon {
  const value = (category ?? "").trim().toUpperCase();
  return ICONS[value] ?? Bell;
}

/** ISO instant -> 「YYYY/MM/DD HH:mm」 in China Standard Time; bad input degrades to plain text. */
export function formatNotificationAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

export function NotificationRow({
  notification,
  href,
  pending,
  onOpen,
}: {
  notification: Notification;
  /** Resolved destination, or null when the row has nowhere safe to go. */
  href: string | null;
  /** A read-state write for this row is in flight. */
  pending: boolean;
  onOpen: (notification: Notification) => void;
}) {
  const Icon = notificationIcon(notification.category);
  const at = formatNotificationAt(notification.createdAt);
  const unread = !notification.read;

  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-full",
          unread ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        {/* The whole line: sentence on the left, time pinned right. */}
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              unread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.title}
          </span>
          {/* The dot is decorative; `read` is what assistive tech is told. */}
          {unread ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
          {at ? <time className="shrink-0 text-xs tabular-nums text-muted-foreground">{at}</time> : null}
        </span>

        {notification.body ? (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </span>
        ) : null}

        {unread ? <span className="sr-only">未读</span> : null}
      </span>
    </>
  );

  /*
   * Unread rows carry a gold bar on the LEADING edge, read rows a transparent
   * one of the same width. The bar is what makes a day group scannable as a
   * timeline: the eye can find "where the new stuff stops" without reading a
   * single title. Keeping the width on both states matters — otherwise every
   * read row would shift 2px relative to the unread ones.
   */
  const className = cn(
    "flex w-full items-start gap-3 rounded-lg border border-border border-l-2 p-4 text-left transition-colors",
    unread
      ? "border-l-accent bg-card hover:border-accent"
      : "border-l-transparent bg-muted/30 hover:bg-muted",
    pending && "opacity-60",
  );

  // A read notification stays clickable only if it still has a destination.
  if (!href) {
    return (
      <li>
        <div className={className}>{body}</div>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        aria-label={notification.title}
        disabled={pending}
        className={className}
        onClick={() => onOpen(notification)}
      >
        {body}
      </button>
    </li>
  );
}
