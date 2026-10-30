import { Link } from "react-router-dom";
import { Heart, MessageSquare } from "lucide-react";
import type { MomentView } from "@/api/moments/moments.types";
import { formatDateTime, formatRelativeTime } from "@/lib/relative-time";
import { staggerDelay } from "@/lib/stagger";

/*
 * A profile's public moments.
 *
 * Deliberately one whole-card link, no like button: this is a reading surface on
 * someone's profile, and the interactions live on the moment detail page. The
 * counts are informational — `MomentView` fills them from the same batched
 * aggregation as the main feed.
 */
export function ProfileMoments({ moments }: { moments: MomentView[] }) {
  if (moments.length === 0) {
    return (
      <p
        data-testid="profile-moments-empty"
        className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground"
      >
        还没有公开动态。
      </p>
    );
  }

  return (
    <ul className="grid list-none gap-3 p-0" data-testid="profile-moments-list">
      {moments.map((moment, index) => (
        <li
          key={moment.id}
          className="animate-rise-in min-w-0"
          style={{ animationDelay: staggerDelay(index) }}
        >
          <Link
            to={`/moments/${moment.id}`}
            className="focus-ring block overflow-hidden rounded-xl border border-border/70 bg-card px-4 py-3.5 transition-colors hover:bg-surface-sunken/30"
          >
            <span className="mb-2 flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
              <time
                dateTime={moment.createdAt}
                title={formatDateTime(moment.createdAt) ?? undefined}
              >
                {formatRelativeTime(moment.createdAt) ?? moment.createdAt}
              </time>
            </span>
            <p className="whitespace-pre-wrap break-words text-card leading-7 text-primary">
              {moment.body}
            </p>
            <span className="mt-3 flex flex-wrap items-center gap-4 border-t border-border/60 pt-2 text-[13px] text-muted-foreground">
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={`${moment.likeCount ?? 0} 次点赞`}
              >
                <Heart aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="tabular-nums">{moment.likeCount ?? 0}</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={`${moment.commentCount ?? 0} 条评论`}
              >
                <MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span className="tabular-nums">{moment.commentCount ?? 0}</span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
