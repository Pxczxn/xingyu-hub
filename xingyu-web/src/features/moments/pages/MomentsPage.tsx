import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, MessageSquare } from "lucide-react";
import { momentsApi } from "@/api/moments/moments.api";
import { FEED_LIMIT, momentAuthorLabel, type MomentView } from "@/api/moments/moments.types";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { buildLoginPath } from "@/features/auth/login-return-path";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/relative-time";
import { staggerDelay } from "@/lib/stagger";
import { MOMENT_MEASURE } from "@/features/moments/moment-measure";

type LoadState = "loading" | "error" | "ready";

export function MomentsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<MomentView[]>([]);
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  /* One id at a time: a second card's like is rejected while the first is in
     flight, which is the same duplicate-click guard ArticleInteractions uses. */
  const [pendingLikeId, setPendingLikeId] = useState<string | null>(null);
  const pendingRef = useRef(false);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    momentsApi
      .list(FEED_LIMIT)
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setBodyError("请填写动态正文");
      return;
    }
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBodyError(null);
    setCreateError(null);
    try {
      const created = await momentsApi.create({ body: trimmed });
      navigate(`/moments/${created.id}`);
    } catch (error) {
      setCreateError(error instanceof ApiError ? error.problem.detail : "发布失败，请稍后重试。");
      pendingRef.current = false;
    }
  }

  function patchItem(id: string, patch: Partial<MomentView>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /*
   * Like, on the feed.
   *
   * The counts arrive WITH the list (one batched query server-side), so opening
   * this page costs exactly one request more than it used to — nothing per card.
   * Only a click talks to the like endpoints.
   *
   * Rollback restores the SNAPSHOT (`moment.liked` / `moment.likeCount` as they
   * were when the click started) rather than subtracting one. The same
   * interleaving that forced ArticleInteractions to do it this way applies here:
   * a count that was `null` at click time is not the server's count.
   */
  async function toggleLike(moment: MomentView) {
    if (!isAuthenticated) return;
    if (pendingLikeId !== null) return; // duplicate-click guard
    const next = moment.liked !== true;
    const snapshot = { liked: moment.liked, likeCount: moment.likeCount };
    setPendingLikeId(moment.id);
    patchItem(moment.id, {
      liked: next,
      likeCount: Math.max(0, (moment.likeCount ?? 0) + (next ? 1 : -1)),
    });
    try {
      if (next) await interactionsApi.like("MOMENT", moment.id);
      else await interactionsApi.unlike("MOMENT", moment.id);
    } catch {
      patchItem(moment.id, snapshot);
    } finally {
      setPendingLikeId(null);
    }
  }

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  const loginHref = buildLoginPath(`${location.pathname}${location.search}`);

  return (
    <div className="section-gap">
      {/*
       * 批次 08 改进：动态广场改用 PageMasthead（无表面开头）。
       * 标题保持"动态"而非"动态广场"——测试和用户习惯都依赖这个简短标题。
       * 原因：动态是开放广场，不是需要"卖"的 landing page；内容流是 P0，应该尽快进入视线。
       */}
      <PageMasthead
        eyebrow="MOMENTS"
        title="动态"
        description="分享此刻的想法，也看看社区正在发生什么。"
      />

      {/*
        Two columns from `lg`, one below it — the same shape HomePage uses
        (`grid ... lg:grid-cols-[minmax(0,1fr)_300px]`), adopted here for the
        same reason: the feed is the page, and the rail is annotation.

        Below `lg` the rail stacks under the feed. It is `hidden` there rather
        than merely reordered because everything in it is repeated context —
        a reader on a phone scrolls to the next moment, not to a paragraph
        explaining what a moment is.
      */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-12">
        <div className={cn("flex min-w-0 flex-col gap-5", MOMENT_MEASURE)}>
          {isAuthenticated ? (
            /*
              Publish dock (P1), tightened in batch 07.
             *
             * The panel header is gone. It was a `bg-surface-sunken` strip carrying a
             * gold dot and the words 「发布 dock」 — 40px of chrome naming an internal
             * term the reader has no use for, and it made the composer read as the
             * heaviest surface on a page whose P0 is the feed underneath it. The
             * invitation now shares a baseline with the action instead.
             *
             * 批次 07（动态页）: the composer drops one step to
             * `bg-surface-sunken/40` instead of `bg-card`. Both used to be white
             * cards in a stack, so the thing you WRITE into and the things you
             * READ carried identical weight; the recessed surface puts the
             * composer behind the feed without turning it into a ghost.
             *
             * The label stays as `sr-only` so the textarea keeps its accessible name
             * (`getByLabelText("动态正文")`), and the button keeps its exact text —
             * both are pinned by moments-page.test.tsx.
             */
            <form
              onSubmit={(event) => void onCreate(event)}
              className="rounded-xl border border-border/70 bg-surface-sunken/40 p-4"
            >
              <div className="flex flex-col gap-3">
                <label className="block">
                  <span className="sr-only">动态正文</span>
                  <textarea
                    name="body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="分享此刻的想法…"
                    className="focus-ring min-h-20 w-full resize-y rounded-lg border border-input bg-card/70 px-3 py-2.5 text-card text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-card"
                  />
                </label>

                {bodyError ? (
                  <p role="alert" className="text-meta text-destructive">
                    {bodyError}
                  </p>
                ) : null}
                {createError ? (
                  <p role="alert" className="text-meta text-destructive">
                    {createError}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <span className="text-meta text-muted-foreground">
                    {body.trim().length > 0 ? `${body.trim().length} 字` : "说点什么再发布"}
                  </span>
                  <Button type="submit" size="sm">
                    发布动态
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link to="/login?returnTo=%2Fmoments" className="text-accent-strong hover:underline">
                发布动态
              </Link>
              需要先登录。
            </p>
          )}

          {items.length === 0 ? (
            <PageState
              kind="empty"
              title="暂时还没有动态"
              className="p-4 [&>svg]:mb-2 [&>svg]:h-12"
            />
          ) : (
            /*
              P0 — the feed. Low-density cards on purpose: the body is the content
              of a moment, so it is set at the card step in the primary colour, and
              the author/time line is the only muted row. No cover image, no excerpt
              — a moment is short by definition, and dressing it up like an article
              would both misstate its length and out-weigh the composer.
             *
             * (The old note here claimed there was "deliberately NO author line".
             * That stopped being true on 2026-10-03, when the server started
             * resolving `authorUsername` / `authorDisplayName`. There is still no
             * avatar — the community profile table has no avatar column, so there
             * is nothing to render and nothing to fake.)
             *
             * THE CARD IS NO LONGER ONE BIG LINK (批次 07).
             *
             * It used to be: a single `<Link>` wrapping everything, which left no
             * room for a like button — a button inside an anchor is invalid HTML,
             * and even if it worked, one click would both like the moment and
             * navigate away from it. So the surface is now a plain `<div>` with
             * two separate targets: the author/body block links to the detail
             * page, and the action row below it holds the real buttons.
             *
             * That is also why `card-lift` is gone. The class lifts a surface on
             * hover to promise "this whole thing is clickable", which is no longer
             * true. The body block carries its own hover instead, so the promise
             * is made by the part that honours it.
             *
             * The stagger delay is INLINE rather than a class, because
             * `animate-rise-in` is the `animation` shorthand and would reset
             * `animation-delay` to 0 if both landed on the same element (see
             * tailwind.config.ts).
             */
            <ul className="grid list-none gap-3 p-0">
              {items.map((item, index) => (
                <li
                  key={item.id}
                  className="animate-rise-in min-w-0"
                  style={{ animationDelay: staggerDelay(index) }}
                >
                  <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
                    <Link
                      to={`/moments/${item.id}`}
                      className="focus-ring group block px-4 py-3.5 transition-colors hover:bg-surface-sunken/30"
                    >
                      {/*
                        Author and time share a line, above the body — the conventional
                        feed order, and the opposite of what this card used to do
                        (body, then a lone timestamp, with no author at all).

                        The time is now a COARSE AGE (`3 小时前`) with the exact
                        instant in `title`. The old `toLocaleString("zh-CN")` printed
                        `2026/10/28 22:03:59`: a 19-character stamp on every card,
                        seconds included, which is both the widest element of the
                        meta row and information nobody reads in a feed. The `title`
                        keeps the exact value available on hover and to assistive
                        technology.
                      */}
                      <span className="mb-2 flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
                        <span className="font-medium text-foreground-soft">
                          {momentAuthorLabel(item)}
                        </span>
                        <span aria-hidden>·</span>
                        <time
                          dateTime={item.createdAt}
                          title={formatDateTime(item.createdAt) ?? undefined}
                        >
                          {formatRelativeTime(item.createdAt) ?? item.createdAt}
                        </time>
                      </span>
                      <p className="whitespace-pre-wrap text-card leading-7 text-primary">
                        {item.body}
                      </p>
                    </Link>

                    {/*
                      The action row. This is the "who may participate" line the
                      page was missing: a reader could see a moment and have no
                      way to respond to it without first opening it, and a guest
                      had no path from "I want to like this" to "here is how".

                      `liked` is nullable, and null means guest — the server sends
                      it only when a session was present. A guest therefore gets a
                      LOGIN LINK labelled with the same count, which is the shape
                      HomeFeedItem already uses for its own cards, instead of a
                      disabled button with no explanation.
                    */}
                    <div className="flex items-center gap-4 border-t border-border/60 px-4 py-2 text-[13px] text-muted-foreground">
                      {isAuthenticated ? (
                        <button
                          type="button"
                          onClick={() => void toggleLike(item)}
                          disabled={pendingLikeId === item.id}
                          aria-pressed={item.liked === true}
                          aria-label={`${item.likeCount ?? 0} 次点赞`}
                          className={cn(
                            "inline-flex items-center gap-1.5 transition-colors disabled:opacity-50",
                            item.liked ? "text-accent-strong" : "hover:text-foreground",
                          )}
                        >
                          <Heart
                            className={cn("h-4 w-4", item.liked && "fill-current")}
                            aria-hidden
                          />
                          {item.likeCount != null && item.likeCount > 0 ? (
                            <span className="tabular-nums">{item.likeCount}</span>
                          ) : (
                            <span>点赞</span>
                          )}
                        </button>
                      ) : (
                        <Link
                          to={loginHref}
                          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                          aria-label={`${item.likeCount ?? 0} 次点赞，登录后可以点赞`}
                          title="登录后点赞"
                        >
                          <Heart className="h-4 w-4" aria-hidden />
                          {item.likeCount != null && item.likeCount > 0 ? (
                            <span className="tabular-nums">{item.likeCount}</span>
                          ) : (
                            <span>点赞</span>
                          )}
                        </Link>
                      )}

                      <Link
                        to={`/moments/${item.id}`}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                        aria-label={`${item.commentCount ?? 0} 条评论`}
                      >
                        <MessageSquare className="h-4 w-4" aria-hidden />
                        {item.commentCount != null && item.commentCount > 0 ? (
                          <span className="tabular-nums">{item.commentCount}</span>
                        ) : (
                          <span>评论</span>
                        )}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/*
          The rail. It holds what used to sit in a footer section under the feed
          (「关于动态」) plus the way into 「我的动态」 — both are context ABOUT the
          page rather than content ON it, and as a footer they pushed the notes
          below a feed that can be 20 cards long.

          It is `hidden lg:block` on purpose: on a narrow viewport the rail is
          repeated context, and stacking it under the feed only adds scrolling.
        */}
        <aside className="hidden min-w-0 lg:sticky lg:top-20 lg:block" aria-label="关于动态">
          <section className="rounded-xl border border-border/70 bg-card p-5">
            <h2 id="moments-notes" className="text-sm font-semibold text-primary">
              关于动态
            </h2>
            <p className="mt-2 text-meta leading-6 text-muted-foreground">
              动态没有草稿：发布后立即公开可见，30 分钟内可编辑；删除后将从动态广场消失。
            </p>
            {isAuthenticated ? (
              <Link
                to="/me/moments"
                className="mt-3 inline-block text-meta text-accent-strong hover:underline"
              >
                我的动态 ›
              </Link>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
