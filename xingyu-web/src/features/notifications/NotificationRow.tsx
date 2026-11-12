import { Bell, Heart, MessageCircle, Megaphone, UserPlus, type LucideIcon } from "lucide-react";
import type { Notification } from "@/api/notifications/notifications.types";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

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
 *
 * 2026-10-13 (batch 07d): three typographic/surface corrections. No behaviour change.
 *
 *   - The title moves `text-sm` -> `text-card`. Same call ConversationRow made in 07c,
 *     for the same reason: this is the row's TITLE, and at 14px it sat one pixel above
 *     the 13px timestamp beside it, so the line had no hierarchy left to read. 15px
 *     against the two `text-meta` lines under it is the gap that restores it.
 *   - The time and the body move `text-xs` -> `text-meta`. `text-meta` is the app's
 *     prose step, and it is also what the day-group count on this very page already
 *     uses — two numbers that belong to one timeline cannot be two sizes.
 * 2026-11-10 (layout batch E) — the row loses its card surface. Notifications is
 * SK4 · H=线 / D=紧 / R=齐 (`.team/design/A-archetypes.md` §3): a notification is
 * a ROW in one timeline, not a card of its own, so the per-row `rounded-xl` +
 * border + `bg-card` box is gone and the page's `<ul>` owns the hairline
 * (`divide-y`). What that changes here:
 *
 *   - no radius and no border, so a row can be full-bleed inside the measured
 *     column without its corners drifting 2px per unread/read state;
 *   - hover is a surface tint (`hover:bg-surface-sunken`) instead of a border
 *     colour change, because there is no border left to change;
 *   - `px-2` keeps the text off the accent bar while the hairline still runs the
 *     full column width.
 *
 * `border-l-2` is untouched and stays on BOTH states. It is not decoration: it is what
 * lets the eye find where the unread run stops without reading a single title, and
 * keeping the width on the read rows is what stops them shifting 2px sideways.
 *
 * 2026-11-10 (R1 cleanup) — the unread icon disc loses its tinted surface. It was
 * `bg-accent/15 text-accent-strong`: after the 2026-11-10 token remap `--accent` is
 * ink, so the wash was already grey rather than blue, but it was still a BACKGROUND
 * that switched on read state — and B v2 §4 / R1 only allows colour emphasis as
 * link / selection / progress / focus ring / dot / bar, never as a face. The disc is
 * now the same `bg-muted` in both states (one of the two page tones R1 permits) and
 * only the glyph differs: `text-foreground` unread, `text-muted-foreground` read.
 *
 * The row therefore still carries three unread signals that cost no coloured surface
 * — the ink `border-l-2` bar described above, the `bg-accent` dot beside the title,
 * and the `font-medium` title — so dropping the tint does not make an unread row
 * harder to find. The glyph contrast (ink vs muted grey) is a fourth, quieter one.
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
  index,
  onOpen,
}: {
  notification: Notification;
  /** Resolved destination, or null when the row has nowhere safe to go. */
  href: string | null;
  /** A read-state write for this row is in flight. */
  pending: boolean;
  /**
   * Position inside its day group, for the entry stagger. Optional because the row is
   * also rendered on its own in the component tests — a row with no position still
   * rises, it just does not wait.
   */
  index?: number;
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
          "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted",
          unread ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        {/* The whole line: sentence on the left, time pinned right. */}
        <span className="flex items-center gap-3">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-card",
              unread ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {notification.title}
          </span>
          {/* The dot is decorative; `read` is what assistive tech is told. */}
          {unread ? <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
          {at ? (
            <time className="shrink-0 text-meta tabular-nums text-muted-foreground">{at}</time>
          ) : null}
        </span>

        {notification.body ? (
          <span className="mt-1 block line-clamp-2 text-meta text-muted-foreground">
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
    "focus-ring flex w-full items-start gap-3 border-l-2 px-2 py-3 text-left transition-colors",
    unread ? "border-l-accent hover:bg-surface-sunken" : "border-l-transparent hover:bg-surface-sunken",
    pending && "opacity-60",
  );

  /*
   * 07d: entry motion, shared by both branches so a read row and an unread row rise
   * identically. The delay rides an inline style on purpose — Tailwind's `animate-*`
   * shorthand resets `animation-delay` whenever both land on the same element, so a
   * utility class cannot win there.
   */
  const entry = {
    className: "animate-rise-in",
    style: index === undefined ? undefined : { animationDelay: staggerDelay(index) },
  };

  // A read notification stays clickable only if it still has a destination.
  if (!href) {
    return (
      <li {...entry}>
        <div className={className}>{body}</div>
      </li>
    );
  }

  return (
    <li {...entry}>
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
