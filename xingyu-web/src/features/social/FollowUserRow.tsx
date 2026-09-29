import { Link } from "react-router-dom";
import type { FollowUser } from "@/api/social/social.types";
import { cn } from "@/lib/cn";

/*
 * One row of a follow-graph list (Phase 2I-1).
 *
 * Shared by /me/following and /me/followers so the two pages cannot drift. The
 * row is presentational only — the follow/unfollow control is passed in by the
 * page, because only the followers page needs it (see below).
 */

/** Falls back to the username when there is no display name, and never renders blank. */
export function followUserLabel(user: FollowUser): string {
  const display = user.displayName?.trim();
  return display || user.username;
}

/** ISO instant -> 「关注于 YYYY/MM/DD」; a missing/odd value degrades to plain text. */
export function formatFollowedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `关注于 ${date.toLocaleDateString("zh-CN")}`;
}

export function FollowUserRow({
  user,
  action,
  className,
}: {
  user: FollowUser;
  /** Optional trailing control (e.g. a follow/unfollow button). */
  action?: React.ReactNode;
  className?: string;
}) {
  const label = followUserLabel(user);
  const followedAt = formatFollowedAt(user.followedAt);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
      >
        {label.slice(0, 1)}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          to={`/u/${encodeURIComponent(user.username)}`}
          className="block truncate text-sm font-medium text-foreground hover:text-accent"
        >
          {label}
        </Link>
        <small className="mt-0.5 block truncate text-xs text-muted-foreground">{`@${user.username}`}</small>
      </span>

      {followedAt ? (
        <time className="shrink-0 text-xs text-muted-foreground">{followedAt}</time>
      ) : null}

      {action ? <span className="shrink-0">{action}</span> : null}
    </li>
  );
}

