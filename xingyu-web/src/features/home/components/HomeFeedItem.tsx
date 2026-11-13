import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bookmark, Heart, MessageSquare } from "lucide-react";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { contentHref } from "@/components/shared/ContentCard";
import { ContentCoverImage } from "@/components/shared/OptimizedImage";
import { buildLoginPath } from "@/features/auth/login-return-path";
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
      className="hidden shrink-0 overflow-hidden rounded-lg sm:block"
    >
      <div className="h-24 w-32 overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-[1.02]">
        <ContentCoverImage src={item.cover} alt="" className="h-24 w-32 object-cover" />
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

  /*
   * Guest login link for the like count.
   *
   * It used to be hardcoded `to="/login?redirect=/home"`, which was wrong twice:
   * `LoginPage` reads `returnTo` (not `redirect`, so the value was ignored) and
   * `/home` is not a route at all. The result was "log in and always land on /".
   * `buildLoginPath` is the same helper the discover / article / topic links use:
   * it returns a bare `/login` for the home route and carries `returnTo` on deep
   * routes, and it refuses to aim at an auth page.
   */
  const location = useLocation();
  const loginPath = buildLoginPath(`${location.pathname}${location.search}`);

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

  /*
   * The heart-pop timer outlives the click that started it, so it has to be owned
   * rather than fire-and-forget: a row that unmounts within the 600ms (a tab
   * switch, a refetch that drops the item) would otherwise leave a `setState`
   * scheduled against a component React has already torn down. In the browser that
   * is a harmless no-op warning; in tests the environment is gone by then and the
   * callback throws `ReferenceError: window is not defined` as an unhandled error.
   */
  const likeAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (likeAnimationTimer.current !== null) {
        clearTimeout(likeAnimationTimer.current);
        likeAnimationTimer.current = null;
      }
    };
  }, []);

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
      if (likeAnimationTimer.current !== null) clearTimeout(likeAnimationTimer.current);
      likeAnimationTimer.current = setTimeout(() => {
        likeAnimationTimer.current = null;
        setLikeAnimating(false);
      }, 600);
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
        "group relative rounded-card border border-border/70 bg-card p-5 transition-shadow hover:shadow-md",
        /*
         * 无封面必须是单列。有封面才声明第二列，否则 Grid 会为不存在的缩略图
         * 留出一条 0 宽隐式列。封面列只在 sm 以上出现，和缩略图的显示断点一致。
         */
        item.cover
          ? "sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-4"
          : "grid grid-cols-1",
      )}
    >
      {hasHeader ? (
        <header className={cn("mb-3 flex items-center gap-3", item.cover && "sm:col-span-2")}>
          {item.avatar ? (
            <img
              data-testid="feed-avatar"
              src={item.avatar}
              alt=""
              loading="lazy"
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : author ? (
            <span
              data-testid="feed-avatar"
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
            >
              {author.slice(0, 1)}
            </span>
          ) : null}
          <div data-testid="feed-byline" className="flex min-w-0 items-center gap-2 text-sm">
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
        </header>
      ) : null}

      <div className="min-w-0">
        <Link
          to={href}
          className="focus-ring mb-2 block line-clamp-2 text-[length:var(--type-h3)] font-semibold leading-tight text-primary transition-colors group-hover:text-accent"
        >
          {item.title}
        </Link>
        {item.summary ? (
          <p className="mb-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
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
      {item.cover ? <HomeFeedVisual item={item} href={href} /> : null}

      {hasLikes || hasComments || canBookmark ? (
        <footer
          className={cn(
            "mt-3 flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 text-sm text-muted-foreground",
            item.cover && "sm:col-span-2",
          )}
        >
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
                to={loginPath}
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
                aria-label={bookmarked ? "已收藏" : "收藏"}
                className={cn(
                  "inline-flex items-center gap-1.5 transition-colors disabled:opacity-50",
                  bookmarked ? "text-accent-strong" : "hover:text-foreground",
                )}
              >
                <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} aria-hidden />
                <span className="sr-only">{bookmarked ? "已收藏" : "收藏"}</span>
              </button>
            ) : null}
        </footer>
      ) : null}
    </article>
  );
}
