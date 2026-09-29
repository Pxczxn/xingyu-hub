import {
  Bell,
  Heart,
  Megaphone,
  MessageCircle,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import type { Notification } from "@/api/notifications/notifications.types";
import { cn } from "@/lib/cn";

/*
 * One notification row (Phase 2I-2).
 *
 * The row is presentational: read-state changes are owned by the page, which is
 * also where the API call lives. Two things this deliberately does NOT do:
 *
 *  1. It does not invent a destination. The payload has no `targetRoute` (see
 *     notifications.types.ts), so the page decides via `notificationFallbackHref`
 *     and passes `href` in. When there is no safe destination the row renders as
 *     plain text rather than a link that leads nowhere.
 *  2. It does not render a per-row 「标为已读」 button. Clicking the row is the
 *     action — matching the Legacy panel, and keeping the list free of a control
 *     that repeats on every line.
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
  label,
  href,
  pending,
  onOpen,
}: {
  notification: Notification;
  /** Localised category name (from notificationCategoryLabel). */
  label: string;
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
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm",
              unread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.title}
          </span>
          {/* The dot is decorative; `read` is what assistive tech is told. */}
          {unread ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
        </span>

        {notification.body ? (
          <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
            {notification.body}
          </span>
        ) : null}

        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{label}</span>
          {at ? <time>{at}</time> : null}
          {unread ? <span className="sr-only">未读</span> : null}
        </span>
      </span>
    </>
  );

  const className = cn(
    "flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors",
    unread ? "bg-card hover:border-accent" : "bg-muted/30 hover:bg-muted",
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
        aria-label={`${notification.title}（${label}）`}
        disabled={pending}
        className={className}
        onClick={() => onOpen(notification)}
      >
        {body}
      </button>
    </li>
  );
}

