import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Heart, MessageSquare } from "lucide-react";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentCoverImage } from "@/components/shared/OptimizedImage";
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

function HomeFeedVisual({ item, href }: { item: ContentSummary; href: string }) {
  /*
   * 只有「真实封面」才出缩略图。
   *
   * 这一版明确去掉了无封面时的渐变占位块和系列生成封面：缩略图是内容的可选
   * 证据，不是版式的一块填充物。没有封面时整列收缩，标题自然占满可用宽度——
   * 一排排同尺寸的占位图会让没有封面的内容看起来像加载失败，也会把正文挤成
   * 窄条。桌面端才显示（`sm:`），移动端保持纯文字列表。
   */
  if (!item.cover) return null;

  return (
    <Link
      to={href}
      tabIndex={-1}
      aria-hidden
      className="hidden shrink-0 overflow-hidden rounded-xl sm:block"
    >
      <div className="h-[104px] w-[168px] overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-[1.02]">
        <ContentCoverImage src={item.cover} alt="" className="h-[104px] w-[168px] object-cover" />
      </div>
    </Link>
  );
}

export type HomeFeedItemVariant = "discover" | "subscription";

export function HomeFeedItem({
  item,
  variant,
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
          "truncate rounded-md px-2 py-0.5",
          isSubscription
            ? "bg-accent/10 font-semibold text-accent-strong"
            : "font-medium text-foreground",
        )}
      >
        {author}
      </span>,
    );
  }
  if (typeLabel) {
    byline.push(
      <span
        key="type"
        className="shrink-0 rounded-md bg-muted/80 px-2 py-0.5 text-muted-foreground"
      >
        {typeLabel}
      </span>,
    );
  }

  const hasHeader = byline.length > 0 || (!isDiscover && Boolean(item.avatar));

  const tags = (item.tags ?? []).filter((tag) => tag && tag.trim()).slice(0, TAG_LIMIT);

  const [liked, setLiked] = useState<boolean | null>(item.liked ?? null);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
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

    // 乐观更新：先更新 UI
    const wasLiked = liked;
    const previousCount = likeCount;
    setLiked(!liked);
    setLikeCount((current) => (typeof current === "number" ? current + (liked ? -1 : 1) : current));

    // 触发动画
    if (!liked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 600);
    }

    try {
      if (wasLiked) {
        await interactionsApi.unlike(type, item.id);
      } else {
        await interactionsApi.like(type, item.id);
      }
    } catch {
      // 失败时回滚
      setLiked(wasLiked);
      setLikeCount(previousCount);
      setError("点赞未完成，请稍后重试。");
    } finally {
      setLikePending(false);
    }
  }

  async function toggleBookmark() {
    if (typeof bookmarked !== "boolean" || bookmarkPending) return;
    setError(null);
    setBookmarkPending(true);

    // 乐观更新
    const wasBookmarked = bookmarked;
    setBookmarked(!bookmarked);

    try {
      if (wasBookmarked) {
        await interactionsApi.removeBookmark(type, item.id);
      } else {
        await interactionsApi.addBookmark(type, item.id);
      }
    } catch {
      // 失败时回滚
      setBookmarked(wasBookmarked);
      setError("收藏操作未完成，请稍后重试。");
    } finally {
      setBookmarkPending(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative",
        "grid items-start gap-y-3 px-5 py-6 sm:px-6",
        /*
         * 只有真封面在场时才分两栏。
         *
         * 无封面还保留第二列，`gap-x-6` 会在右侧白白吃掉 24px —— 文字区被压窄，
         * 却看不到任何东西占着它。所以没有封面时直接单列：标题与摘要吃满整行，
         * 视觉上也不会留下「这行少了一张图」的空位。
         */
        item.cover ? "grid-cols-[minmax(0,1fr)_auto] gap-x-6" : "grid-cols-1",
        "transition-colors duration-200 ease-out",
        "hover:bg-muted/40",
      )}
    >
      <div className="col-start-1 row-start-1 min-w-0">
        <Link
          to={href}
          className="focus-ring mb-1.5 block line-clamp-2 text-[17px] font-bold leading-7 text-foreground md:text-[19px]"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mb-2.5 line-clamp-2 max-w-[62ch] text-[15px] leading-7 text-muted-foreground">
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

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {/*
       * 缩略图占位只在真有封面时才存在。
       *
       * `col-start-2` 在没有封面时也会逼出一条隐式列（实测 grid-template-columns
       * 变成「830.5px 0px」）—— 宽 0，不影响读数，但它让容器的列定义和实际内容
       * 长期对不上，后面谁再往这格里加东西就会凭空多出半栏。null 时整块不渲染。
       */}
      {item.cover ? (
        <div className="col-start-2 row-span-2">
          <HomeFeedVisual item={item} href={href} />
        </div>
      ) : null}

      {/*
       * 元信息条。
       *
       * 作者、类型与互动数必须在同一条线上连续读完——它们回答的是同一个问题
       * 「这条是谁写的、好不好」；把它们拆到右侧竖栏会让视线在行内来回跳跃，
       * 也让无封面行空出半行。所以这里只有一条横向元信息，窄屏自动换行。
       */}
      <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {hasHeader ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/*
             * Avatar — DISCOVERY ONLY.
             *
             * A discovery feed scans by CONTENT; a subscription feed scans by WHO
             * published. That is a product-semantics split, so the switch is the
             * variant rather than the payload: there is deliberately no "show it
             * only when a real avatar exists" branch, because that would start rows
             * at different x-positions and hand users with pictures a heavier row.
             */}
            {item.avatar ? (
              <img
                data-testid="feed-avatar"
                src={item.avatar}
                alt=""
                loading="lazy"
                className="h-7 w-7 rounded-full object-cover"
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
            <div data-testid="feed-byline" className="flex min-w-0 items-center gap-2">
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
          </div>
        ) : null}

        {hasLikes || hasComments || canBookmark ? (
          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
            {canLike ? (
              <button
                type="button"
                onClick={() => void toggleLike()}
                disabled={likePending}
                aria-pressed={liked === true}
                aria-label={`${likeCount ?? 0} 次点赞`}
                className={cn(
                  "inline-flex items-center gap-1.5 transition-colors disabled:opacity-50",
                  liked ? "text-accent-strong" : "hover:text-foreground",
                )}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 transition-all duration-300",
                    liked && "fill-current",
                    likeAnimating && "animate-heart-pop",
                  )}
                  aria-hidden
                />
                {typeof likeCount === "number" && likeCount > 0 ? (
                  <span
                    className={cn(
                      "tabular-nums transition-all duration-200",
                      likeAnimating && "animate-count-bounce",
                    )}
                  >
                    {likeCount}
                  </span>
                ) : null}
              </button>
            ) : hasLikes ? (
              <Link
                to="/login?redirect=/home"
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                aria-label={`${likeCount ?? 0} 次点赞`}
                title="登录后点赞"
              >
                <Heart className="h-4 w-4" aria-hidden />
                {typeof likeCount === "number" && likeCount > 0 ? (
                  <span className="tabular-nums">{likeCount}</span>
                ) : null}
              </Link>
            ) : null}

            {hasComments ? (
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={`${item.commentCount} 条评论`}
              >
                <MessageSquare className="h-4 w-4" aria-hidden />
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
                  "inline-flex items-center gap-1.5 transition-colors disabled:opacity-50",
                  bookmarked ? "text-accent-strong" : "hover:text-foreground",
                )}
              >
                <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} aria-hidden />
                <span className="text-xs">{bookmarked ? "已收藏" : "收藏"}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
