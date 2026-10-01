import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Heart, MessageSquare } from "lucide-react";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentVisual } from "@/components/visual/ContentVisual";
import { SeriesCover } from "@/components/visual/SeriesCover";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/relative-time";
import type { ContentSummary } from "@/api/common.types";

/*
 * One row of the home feed — a vertical list item, not a card.
 *
 * The home page is a community content feed, so recommendations are read
 * top-to-bottom as rows. `ContentCard` (the grid primitive) stays untouched:
 * discover / search / topic still render cards, and only Home opts into rows.
 *
 * Link resolution is shared with ContentCard via `contentHref`, so the home feed
 * can never drift into emitting a dead link that the card would not.
 *
 * EVERY OPTIONAL FIELD DEGRADES TO NOTHING. `authorName` / `avatar` / `tags` /
 * the counters are supplied by the server's enrichment pass, and a payload that
 * predates it simply has fewer of them. The row must never render a placeholder
 * for data it does not have: an empty avatar circle or a hardcoded "0 赞" reads
 * as a real value and is worse than absence.
 *
 * 点赞 and 收藏 are INTERACTIVE, because the server now sends `liked` /
 * `bookmarked` per row (viewer-scoped batch lookups), so the controls can start
 * in the right state instead of guessing. Each renders as a BUTTON only when its
 * flag is a real boolean; `undefined`/`null` means nobody is signed in, and a
 * control for a guest would 401 on click. The comment count stays a plain number:
 * commenting happens on the detail page, which owns the composer.
 *
 * Both toggles flip ONLY after the request succeeds. Flipping first and leaving it
 * flipped on failure is a bug this codebase has already fixed once.
 *
 * ⚠️ `typeof x === "boolean"` / `typeof x === "number"`, NOT `!== undefined`: the
 * server serialises an unknown value as JSON `null`, which arrives as `null`
 * rather than `undefined`. Checking only for `undefined` would render a save
 * button for guests and print "null" next to the heart.
 */

/*
 * Type badge copy. Unknown / missing object types render no badge rather than an
 * empty chip — `||` (not `??`) so an empty-string objectType also degrades.
 */
const TYPE_LABELS: Record<string, string> = {
  ARTICLE: "文章",
  SERIES: "系列",
  MOMENT: "动态",
};

const TAG_LIMIT = 3;

function HomeFeedVisual({
  item,
  href,
  type,
}: {
  item: ContentSummary;
  href: string;
  type: string;
}) {
  const visual =
    type === "SERIES" && !item.cover ? (
      <SeriesCover stableKey={`${item.id}:${item.title}`} title={item.title} variant="thumbnail" />
    ) : (
      <ContentVisual
        stableKey={item.id || item.title}
        objectType={type}
        cover={item.cover}
        variant="compact"
        className="h-20 w-[120px] aspect-auto rounded-md"
      />
    );

  return (
    <Link to={href} tabIndex={-1} aria-hidden className="hidden shrink-0 sm:block">
      {visual}
    </Link>
  );
}

export function HomeFeedItem({ item, className }: { item: ContentSummary; className?: string }) {
  const type = (item.objectType ?? "").toUpperCase();
  const typeLabel = TYPE_LABELS[type] || "";
  const href = contentHref(item);

  const author = item.authorName;
  const time = formatRelativeTime(item.updatedAt);
  const hasHeader = Boolean(author || item.avatar || time || typeLabel);

  const tags = (item.tags ?? []).filter((tag) => tag && tag.trim()).slice(0, TAG_LIMIT);

  const [liked, setLiked] = useState<boolean | null>(item.liked ?? null);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [bookmarked, setBookmarked] = useState<boolean | null>(item.bookmarked ?? null);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when the payload changes (a tab switch or a refetch), so the controls
  // reflect the server rather than a stale local flip.
  useEffect(() => {
    setLiked(item.liked ?? null);
    setLikeCount(item.likeCount);
    setBookmarked(item.bookmarked ?? null);
    setError(null);
  }, [item.liked, item.likeCount, item.bookmarked]);

  const hasLikes = typeof likeCount === "number";
  const hasComments = typeof item.commentCount === "number";
  const canLike = typeof liked === "boolean" && Boolean(type);
  const canBookmark = typeof bookmarked === "boolean" && Boolean(type);

  async function toggleLike() {
    if (typeof liked !== "boolean" || likePending) return;
    setError(null);
    setLikePending(true);
    try {
      if (liked) {
        await interactionsApi.unlike(type, item.id);
      } else {
        await interactionsApi.like(type, item.id);
      }
      // Only now flip. The count moves by exactly one because the request that
      // changed it has already been accepted.
      setLiked(!liked);
      setLikeCount((current) =>
        typeof current === "number" ? current + (liked ? -1 : 1) : current,
      );
    } catch {
      setError("点赞未完成，请稍后重试。");
    } finally {
      setLikePending(false);
    }
  }

  async function toggleBookmark() {
    if (typeof bookmarked !== "boolean" || bookmarkPending) return;
    setError(null);
    setBookmarkPending(true);
    try {
      if (bookmarked) {
        await interactionsApi.removeBookmark(type, item.id);
      } else {
        await interactionsApi.addBookmark(type, item.id);
      }
      setBookmarked(!bookmarked);
    } catch {
      setError("收藏操作未完成，请稍后重试。");
    } finally {
      setBookmarkPending(false);
    }
  }

  return (
    <article className={cn("flex gap-4 py-4 first:pt-4 last:pb-4", className)}>
      <div className="min-w-0 flex-1">
        {hasHeader ? (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            {item.avatar ? (
              <img src={item.avatar} alt="" loading="lazy" className="h-7 w-7 rounded-full" />
            ) : author ? (
              <span
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
              >
                {author.slice(0, 1)}
              </span>
            ) : null}
            {author ? <span className="truncate font-medium text-foreground">{author}</span> : null}
            {time ? <span className="shrink-0">{time}</span> : null}
            {typeLabel ? (
              <span className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[11px] leading-4">
                {typeLabel}
              </span>
            ) : null}
          </div>
        ) : null}

        <Link
          to={href}
          className="focus-ring block line-clamp-2 text-base font-semibold leading-6 text-foreground hover:text-accent md:text-[17px]"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {item.summary}
          </p>
        ) : null}

        {tags.length > 0 ? (
          <ul aria-label="话题标签" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag}
              </li>
            ))}
          </ul>
        ) : null}

        {hasLikes || hasComments || canBookmark ? (
          <div className="mt-2.5 flex items-center gap-5 text-xs text-muted-foreground">
            {canLike ? (
              <button
                type="button"
                onClick={() => void toggleLike()}
                disabled={likePending}
                aria-pressed={liked === true}
                aria-label={`${likeCount ?? 0} 次点赞`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors disabled:opacity-50",
                  liked ? "text-accent hover:bg-muted" : "hover:bg-muted hover:text-foreground",
                )}
              >
                <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} aria-hidden />
                {typeof likeCount === "number" && likeCount > 0 ? (
                  <span className="tabular-nums">{likeCount}</span>
                ) : null}
              </button>
            ) : hasLikes ? (
              <span className="inline-flex items-center gap-1.5" aria-label={`${likeCount} 次点赞`}>
                <Heart className="h-3.5 w-3.5" aria-hidden />
                {likeCount > 0 ? <span className="tabular-nums">{likeCount}</span> : null}
              </span>
            ) : null}

            {hasComments ? (
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={`${item.commentCount} 条评论`}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                {typeof item.commentCount === "number" && item.commentCount > 0 ? (
                  <span className="tabular-nums">{item.commentCount}</span>
                ) : null}
              </span>
            ) : null}

            {canBookmark ? (
              <button
                type="button"
                onClick={() => void toggleBookmark()}
                disabled={bookmarkPending}
                aria-pressed={bookmarked === true}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors disabled:opacity-50",
                  bookmarked
                    ? "text-accent hover:bg-muted"
                    : "hover:bg-muted hover:text-foreground",
                )}
              >
                <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-current")} aria-hidden />
                {bookmarked ? "已收藏" : "收藏"}
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <HomeFeedVisual item={item} href={href} type={type} />
    </article>
  );
}
