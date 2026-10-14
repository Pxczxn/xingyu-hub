import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { momentsApi } from "@/api/moments/moments.api";
import { FEED_LIMIT, momentAuthorLabel, type MomentView } from "@/api/moments/moments.types";
import { ApiError } from "@/api/client";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { staggerDelay } from "@/lib/stagger";

type LoadState = "loading" | "error" | "ready";

function formatMomentTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

export function MomentsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<MomentView[]>([]);
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
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
         * The label stays as `sr-only` so the textarea keeps its accessible name
         * (`getByLabelText("动态正文")`), and the button keeps its exact text —
         * both are pinned by moments-page.test.tsx.
         */
        <form
          onSubmit={(event) => void onCreate(event)}
          className="rounded-xl border border-border/70 bg-card p-4"
        >
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="sr-only">动态正文</span>
              <textarea
                name="body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="分享此刻的想法…"
                className="focus-ring min-h-20 w-full resize-y rounded-lg border border-input bg-surface-sunken/50 px-3 py-2.5 text-card text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:bg-card"
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
        <PageState kind="empty" title="暂时还没有动态" className="p-4 [&>svg]:mb-2 [&>svg]:h-12" />
      ) : (
        /*
          P0 — the feed. Low-density cards on purpose: the body is the content of
          a moment, so it is set at the card step in the primary colour, and the
          author/time line is the only muted row. No cover image, no excerpt, no
          counter row — a moment is short by definition, and dressing it up like
          an article would both misstate its length and out-weigh the composer.
         *
         * (The old note here claimed there was "deliberately NO author line".
         * That stopped being true on 2026-10-03, when the server started
         * resolving `authorUsername` / `authorDisplayName`; the line below is the
         * real one. There is still no avatar — the community profile table has no
         * avatar column, so there is nothing to render and nothing to fake.)
         *
         * Each card is a whole-card link, so it takes `card-lift`: the border
         * sharpens to full and the card rises 2px on hover. The stagger delay is
         * INLINE rather than a class, because `animate-rise-in` is the `animation`
         * shorthand and would reset `animation-delay` to 0 if both landed on the
         * same element (see tailwind.config.ts).
        */
        <ul className="grid list-none gap-3 p-0">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="animate-rise-in min-w-0"
              style={{ animationDelay: staggerDelay(index) }}
            >
              <Link
                to={`/moments/${item.id}`}
                className="card-lift focus-ring block rounded-xl border border-border/70 bg-card p-4"
              >
                {/*
                  Author and time share a line, above the body — the conventional
                  feed order, and the opposite of what this card used to do
                  (body, then a lone timestamp, with no author at all).

                  The author could not be shown before 2026-10-03: the moment
                  contract carried only `authorId`, an opaque string. The backend
                  now resolves `authorUsername` / `authorDisplayName`, and
                  `momentAuthorLabel` handles a server that has not shipped them
                  yet. There is no avatar — the community profile has no avatar
                  column, so there is nothing to render and nothing to fake.
                */}
                <span className="mb-2 flex flex-wrap items-center gap-x-2 text-meta text-muted-foreground">
                  <span className="font-medium text-foreground-soft">
                    {momentAuthorLabel(item)}
                  </span>
                  <span aria-hidden>·</span>
                  <time dateTime={item.createdAt}>{formatMomentTime(item.createdAt)}</time>
                </span>
                <p className="whitespace-pre-wrap text-card leading-6 text-primary">{item.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/*
        P2 — what a moment is, and where your own live. Last on the page on
        purpose: it is the thing a reader wants after the feed, not before it.
       *
       * It does NOT re-list the community sections (发现 / 话题 / 星系 / 活动). Those
       * already sit in the shell's primary navigation; repeating global nav at
       * the foot of one page is noise, not discovery. What it states instead is
       * the part of the contract the cards cannot show: a moment has no draft
       * state (public the instant it is posted), the edit window is 30 minutes
       * (MOMENT_EDIT_WINDOW_SECONDS), and a trashed moment reads as 404 — which
       * is what 「删除」 means here.
       *
       * 「我的动态」 is for signed-in readers only: the route is behind RequireAuth,
       * so showing it to a guest would be a link into a redirect. Guests still
       * get the note; their way in is the composer above.
      */}
      <section aria-labelledby="moments-notes" className="border-t border-border/60 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="moments-notes" className="text-sm font-semibold text-primary">
            关于动态
          </h2>
          {isAuthenticated ? (
            <Link
              to="/me/moments"
              className="shrink-0 text-meta text-accent-strong hover:underline"
            >
              我的动态 ›
            </Link>
          ) : null}
        </div>
        <p className="mt-2 max-w-2xl text-meta leading-6 text-muted-foreground">
          动态没有草稿：发布后立即公开可见，30 分钟内可编辑；删除后将从动态广场消失。
        </p>
      </section>
    </div>
  );
}
