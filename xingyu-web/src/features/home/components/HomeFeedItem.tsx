import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Heart, MessageSquare } from "lucide-react";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentVisual } from "@/components/visual/ContentVisual";
import { SeriesCover } from "@/components/visual/SeriesCover";
import { cn } from "@/lib/cn";
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

export type HomeFeedItemVariant = "discover" | "subscription";

export function HomeFeedItem({
  item,
  variant,
  className,
}: {
  item: ContentSummary;
  /*
   * Optional feed-semantics variant.
   *
   * Omitting it keeps the row EXACTLY as it was, so every existing caller is
   * unaffected; the home page opts in per tab.
   *
   *   discover     发现型 Feed — 「兴趣匹配」是它要传达的东西，所以话题标签被提亮
   *                成品牌色的兴趣信号（作者/时间保持默认的弱层级）。
   *   subscription 订阅型 Feed — 关注关系与更新时机才是重点，所以作者加重一档、
   *                时间提亮到 foreground-soft，读成「谁 · 什么时候」。
   *
   * NEITHER variant removes information. An earlier draft had 发现 drop the
   * timestamp, which broke `renders the enrichment it was given` — that test
   * encodes the product rule that a row shows the data it was handed. The
   * difference between the tabs is EMPHASIS, not presence.
   *
   * The two also deliberately share ONE skeleton and one interaction model. The
   * difference is information hierarchy, not a second component — duplicating the
   * row would be the "为了差异化做成两套" failure mode.
   */
  variant?: HomeFeedItemVariant;
  className?: string;
}) {
  const isSubscription = variant === "subscription";
  const isDiscover = variant === "discover";

  const type = (item.objectType ?? "").toUpperCase();
  const typeLabel = TYPE_LABELS[type] || "";
  const href = contentHref(item);

  const author = item.authorName;

  /*
   * NO TIMESTAMP IS RENDERED — in either feed.
   *
   * Both rails hand this row `ContentSummary.updatedAt`, and on the home endpoint
   * that value is `search_document.indexed_at`:
   *
   *   HomeService.toSearchView()      -> updatedAt(doc.getIndexedAt())
   *   HomeService.followingUpdatesFor -> sorted by indexedAt, same mapping
   *
   * `indexed_at` is written as `Instant.now()` on EVERY index upsert
   * (SearchDocumentIndexProvider.upsert), and a Series is re-indexed by
   * `SeriesService.update()`, which also fires for a title or description edit.
   * An operator rebuild moves it again — two rows in the dev database already sit
   * 19.5 minutes later than the entity they describe.
   *
   * So it is not a publication time, not an edit time, and not a "content was
   * updated" time. Rendered as 「3 天前」 it would assert a fact the data does not
   * carry, and a reader would take it as "published 3 days ago".
   *
   * It comes back only when the index can carry a real content time. For an
   * ARTICLE that time already exists as `PublishedRevision.publishedAt` (exposed
   * on article detail as `ArticlePublicView.publishedAt`) but it is NOT in this
   * payload; for a SERIES no such field exists at all.
   *
   * Time-semantics contract debt, NOT fixed here because it is outside this page:
   * ContinueReadingStrip.tsx and TopicContentItem.tsx still render `indexed_at`
   * as if it were a content time. Audit them together after the static pass.
   */

  /*
   * Byline parts, in reading order: 作者 · 类型.
   *
   * Built from presence so the separator can never dangle — an item with a type
   * but no author renders just the type, and one with neither renders no byline
   * at all. The type is PLAIN METADATA now: it used to be a `rounded-full
   * bg-muted` chip, which is the exact shape the topic tags use, so "what kind of
   * thing is this" and "what is this about" were being said in one visual
   * language. Tags keep the pill; the type is words.
   */
  const byline: ReactNode[] = [];
  if (author) {
    byline.push(
      <span
        key="author"
        className={cn(
          "truncate text-foreground",
          isSubscription ? "font-semibold" : "font-medium",
        )}
      >
        {author}
      </span>,
    );
  }
  if (typeLabel) {
    byline.push(
      <span key="type" className="shrink-0">
        {typeLabel}
      </span>,
    );
  }

  const hasHeader = byline.length > 0 || (!isDiscover && Boolean(item.avatar));

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
          <div
            data-testid="feed-byline"
            className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"
          >
            {/*
             * Avatar — DISCOVERY ONLY.
             *
             * A discovery feed scans by CONTENT; a subscription feed scans by WHO
             * published. That is a product-semantics split, so the switch is the
             * variant rather than the payload: there is deliberately no "show it
             * only when a real avatar exists" branch, because that would start rows
             * at different x-positions and hand users with pictures a heavier row.
             */}
            {isDiscover ? null : item.avatar ? (
              <img
                data-testid="feed-avatar"
                src={item.avatar}
                alt=""
                loading="lazy"
                className="h-7 w-7 rounded-full"
              />
            ) : author ? (
              <span
                data-testid="feed-avatar"
                aria-hidden
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
              >
                {author.slice(0, 1)}
              </span>
            ) : null}

            {/* Separator generated from presence — never a hardcoded 「·」 between slots. */}
            {byline.map((node, index) => (
              <Fragment key={index}>
                {index > 0 ? (
                  <span aria-hidden className="shrink-0 text-muted-foreground/50">
                    ·
                  </span>
                ) : null}
                {node}
              </Fragment>
            ))}
          </div>
        ) : null}

        <Link
          to={href}
          className="focus-ring block line-clamp-2 text-base font-semibold leading-6 text-foreground hover:text-accent-strong md:text-[17px]"
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
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  /*
                   * 发现型 treats a topic as the interest signal the row is matched
                   * on, so its chip carries brand colour. 订阅型 keeps the chip
                   * neutral — there you already know why the row is in front of you.
                   *
                   * Additive only: a row that has no tags still shows none, and no
                   * copy changes between the two variants.
                   */
                  isDiscover
                    ? "bg-accent-soft text-accent-strong"
                    : "bg-muted/70 text-muted-foreground",
                )}
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
                  liked ? "hover:bg-muted" : "hover:bg-muted hover:text-foreground",
                )}
              >
                {/*
                 * Semantic colour split, not a blanket token swap.
                 *
                 * The heart is a filled mark and is `aria-hidden` — it is
                 * decoration, so it keeps the vivid brand gold. The count beside it
                 * is TEXT and resolves through --accent-strong, because raw gold on
                 * white measures 2.15:1 while accent-strong measures 5.05:1.
                 */}
                <Heart
                  className={cn("h-3.5 w-3.5", liked && "fill-current text-accent")}
                  aria-hidden
                />
                {typeof likeCount === "number" && likeCount > 0 ? (
                  <span className={cn("tabular-nums", liked && "text-accent-strong")}>
                    {likeCount}
                  </span>
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
                  bookmarked ? "hover:bg-muted" : "hover:bg-muted hover:text-foreground",
                )}
              >
                <Bookmark
                  className={cn("h-3.5 w-3.5", bookmarked && "fill-current text-accent")}
                  aria-hidden
                />
                {bookmarked ? (
                  <span className="text-accent-strong">已收藏</span>
                ) : (
                  "收藏"
                )}
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
