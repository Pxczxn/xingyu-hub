import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, MessageSquare } from "lucide-react";
import { momentsApi } from "@/api/moments/moments.api";
import { FEED_LIMIT, momentAuthorLabel, type MomentView } from "@/api/moments/moments.types";
import { interactionsApi } from "@/api/interactions/interactions.api";
import { ApiError } from "@/api/client";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { buildLoginPath } from "@/features/auth/login-return-path";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/relative-time";
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

  /*
   * SK2 画廊 · H 线 / D 紧 / R 齐（A §3 的 /moments 行）。
   *
   *   skeleton="SK2"    → 画廊原型；本页不传 `rail`，`SOLO.SK2` 生效 —— 只有一列。
   *   header="line"     → H=线：`PageMasthead`（无面 masthead）。标题保持「动态」
   *                       而不是「动态广场」：路由测试与用户习惯都依赖这个短标题。
   *   density="compact" → D=紧：条目是**发丝线行**（`FeedRow`），没有逐项卡面。
   *                       这是与同为 SK2 的 `GalaxyListPage` / `EventsPage` 的区分手段：
   *                       那两页一个「幅」一个「紧」，本页走「线」+「紧」，首屏第一块
   *                       是页头而不是横幅或格子。
   *   R=齐             → 没有侧轨、没有偏移块：页头、发布框、行流、页脚说明共用同一条
   *                       左缘与同一最大宽度（`MOMENT_MEASURE`，与详情页同一个常量）。
   *
   * 栏宽仍然锁 `MOMENT_MEASURE`（46rem）：不锁的话 1200px 的 shell 会把 15px 正文
   * 拉成每行 ~80 个汉字，而详情页是 ~47 —— 点进再退回会重新折行（见
   * `moment-measure.ts`）。它挂在 frame 的 `className` 上，于是整页只有一个宽度定义。
   *
   * 原来那一栏「关于动态」从侧轨回到内容流末尾：R=齐 的定义就是「全部区块与内容列
   * 同宽同边」，保留一条 sticky 侧轨会同时违反它和 A §2 的四元组判定。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="line"
      density="compact"
      className={MOMENT_MEASURE}
      headerSlot={
        <PageMasthead
          eyebrow="MOMENTS"
          title="动态"
          description="分享此刻的想法，也看看社区正在发生什么。"
        />
      }
    >
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
          className="rounded-card border border-border/70 bg-surface-sunken/40 p-4"
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
        <p className="text-meta text-muted-foreground">
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
          P0 — the feed，D=紧：每一条是**行**，不是卡。

          行制交给 `FeedRow`（发丝线分隔、无卡面、无逐项 padding 边框），页面只
          决定行里放什么：作者与时间、正文、以及互动行。

          THE ROW IS STILL NOT ONE BIG LINK（批次 07 的判据未变）：整行一个 `<Link>`
          会让点赞按钮无处安放（按钮不能嵌在 a 里，何况一次点击会同时点赞并离开本页）。
          所以正文块自己是一个链接，互动行是真正的按钮。

          时间仍是 COARSE AGE（`3 小时前`）并把精确时刻放进 `title` —— 19 字的
          `2026/10/28 22:03:59` 是行元信息里最宽的一样东西，而没有人读它的秒数。
        */
        <ul className="flex flex-col">
          {items.map((item) => (
            <FeedRow
              key={item.id}
              meta={
                <time
                  dateTime={item.createdAt}
                  title={formatDateTime(item.createdAt) ?? undefined}
                >
                  {formatRelativeTime(item.createdAt) ?? item.createdAt}
                </time>
              }
            >
              <Link
                to={`/moments/${item.id}`}
                className="focus-ring group block rounded-sm"
              >
                <span className="block text-meta font-medium text-foreground-soft transition-colors group-hover:text-accent-strong">
                  {momentAuthorLabel(item)}
                </span>
                <span className="mt-1 block whitespace-pre-wrap text-card leading-7 text-primary">
                  {item.body}
                </span>
              </Link>

              {/*
                The action row. This is the "who may participate" line the
                page was missing: a reader could see a moment and have no
                way to respond to it without first opening it, and a guest
                had no path from "I want to like this" to "here is how".

                `liked` is nullable, and null means guest — the server sends
                it only when a session was present. A guest therefore gets a
                LOGIN LINK labelled with the same count, which is the shape
                HomeFeedItem already uses for its own rows, instead of a
                disabled button with no explanation.
              */}
              <div className="mt-2 flex items-center gap-4 text-meta text-muted-foreground">
                {isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => void toggleLike(item)}
                    disabled={pendingLikeId === item.id}
                    aria-pressed={item.liked === true}
                    aria-label={`${item.likeCount ?? 0} 次点赞`}
                    className={cn(
                      "focus-ring inline-flex items-center gap-1.5 rounded-sm transition-colors disabled:opacity-50",
                      item.liked ? "text-accent-strong" : "hover:text-foreground",
                    )}
                  >
                    <Heart className={cn("h-4 w-4", item.liked && "fill-current")} aria-hidden />
                    {item.likeCount != null && item.likeCount > 0 ? (
                      <span className="tabular-nums">{item.likeCount}</span>
                    ) : (
                      <span>点赞</span>
                    )}
                  </button>
                ) : (
                  <Link
                    to={loginHref}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground"
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
                  className="focus-ring inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground"
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
            </FeedRow>
          ))}
        </ul>
      )}

      {/*
        页脚说明（原侧轨第一块）。R=齐 之后它回到内容流末尾：动态没有草稿、
        发布后立即公开可见、30 分钟内可编辑、删除后从广场消失 —— 这些是**关于这一页**
        的规则，读完流之后再读到它是对的。
      */}
      <section aria-labelledby="moments-notes" className="border-t border-border/70 pt-5">
        <h2 id="moments-notes" className="text-h3 font-semibold text-primary">
          关于动态
        </h2>
        <p className="mt-2 text-meta leading-6 text-muted-foreground">
          动态没有草稿：发布后立即公开可见，30 分钟内可编辑；删除后将从动态广场消失。
        </p>
        {isAuthenticated ? (
          <Link
            to="/me/moments"
            className="focus-ring mt-2 inline-block rounded-sm text-meta text-accent-strong hover:underline"
          >
            我的动态 ›
          </Link>
        ) : null}
      </section>
    </ArchetypeFrame>
  );
}
