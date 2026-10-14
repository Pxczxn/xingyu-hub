import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; series: PublicSeriesDetail };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/*
 * Public series detail (Phase 2G + Series Subscription Closure, 2026-10-10).
 *
 * Backend: GET /api/v1/series/{id} -> SeriesDetail, 404 for a missing or
 * non-ACTIVE series. Chapters come back ordered by `position`; each links to
 * the underlying article.
 *
 * Subscription: the payload now carries viewer-scoped `hasSubscribed`
 * (true/false for signed-in viewers, null for guests), so the control starts
 * in the right state after a refresh — no parallel bookshelf probing. Toggle
 * uses the same optimistic/guard/rollback discipline as the interaction bar;
 * the backend unsubscribe is idempotent and (unlike subscribe) has no ACTIVE
 * status gate, so existing subscribers can always cancel.
 */
export function PublicSeriesDetailPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [subscribePending, setSubscribePending] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!seriesId) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    setSubscribed(null);
    setSubscribeError(null);
    seriesApi
      .getPublicById(seriesId)
      .then((series) => {
        if (!active) return;
        setState({ kind: "ready", series });
        setSubscribed(typeof series.hasSubscribed === "boolean" ? series.hasSubscribed : null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "unavailable" : "error" });
      });
    return () => {
      active = false;
    };
  }, [seriesId, reloadKey]);

  async function onToggleSubscribe() {
    if (subscribePending || subscribed === null) return; // duplicate-click guard
    setSubscribeError(null);
    // Snapshot + restore, not `!next`. They are the same value here because
    // this is the only writer, but naming the snapshot makes the invariant
    // visible: the rollback restores the pre-click state, it does not recompute
    // it from the state the click produced.
    const previous = subscribed;
    const next = !subscribed;
    setSubscribed(next);
    setSubscribePending(true);
    try {
      if (next) await seriesApi.subscribe(seriesId);
      else await seriesApi.unsubscribe(seriesId);
    } catch {
      setSubscribed(previous);
      setSubscribeError(next ? "订阅失败，请重试。" : "取消订阅失败，请重试。");
    } finally {
      setSubscribePending(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") {
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
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="系列不存在或尚未公开" />;
  }

  const { series } = state;
  const chapters = [...(series.chapters ?? [])].sort((a, b) => a.position - b.position);

  return (
    <article className="section-gap">
      <nav aria-label="面包屑" className="text-meta text-muted-foreground">
        <Link
          to="/series"
          className="focus-ring rounded-sm transition-colors hover:text-accent-strong"
        >
          系列广场
        </Link>
        <span aria-hidden className="mx-2 text-border">
          /
        </span>
        <span className="text-foreground">{series.title}</span>
      </nav>

      {/*
        Opening block, not a card.
        ============================================================
        This was `rounded-lg border border-border bg-card p-6` — a framed panel
        holding a title, an author, a paragraph and two controls. On a series
        page that is the wrong first object: §六③ says the series should show
        the WORKS before it explains them, and a `p-6` frame with a 1px border
        and its own surface announces "here is a summary, the content starts
        below" to a reader whose actual goal is the chapter list 60px further
        down.

        Dropping the surface costs nothing that the content needs — the title is
        already the largest thing on the page. It also removes a second
        rectangle from a page whose real structure is one list.
      */}
      <header className="flex flex-col gap-4">
        <h1 className="text-display font-semibold tracking-tight text-primary">{series.title}</h1>

        {/* Author and chapter count are the same kind of fact — who and how
            much — so they share one `text-meta` line instead of the two
            separate blocks the card had. The count moves up here from below the
            description: a reader deciding whether to start needs the length
            next to the name, not after a paragraph. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
          <Link
            to={`/u/${encodeURIComponent(series.author.username)}`}
            className="focus-ring rounded-sm font-medium text-foreground transition-colors hover:text-accent-strong"
          >
            {series.author.displayName?.trim() || `@${series.author.username}`}
          </Link>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span className="tabular-nums">{`${chapters.length} 章`}</span>
        </div>

        <p className="max-w-[68ch] text-[15px] leading-7 text-muted-foreground">
          {series.description || "该系列暂未提供简介。"}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {/* P1, and the reason most readers opened this page — so it is a real
              button now. It used to be a 13px `text-accent` link, the same
              weight as the breadcrumb above it, which made "start reading"
              quieter than the thing it starts. */}
          {chapters.length > 0 ? (
            <Button asChild>
              <Link to={`/series/${encodeURIComponent(series.id)}/read`}>开始阅读</Link>
            </Button>
          ) : null}

          {!isAuthenticated ? (
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/series/${series.id}`)}`}
              className="focus-ring rounded-sm text-meta font-medium text-accent-strong hover:underline"
            >
              登录后订阅
            </Link>
          ) : subscribed !== null ? (
            <Button
              type="button"
              variant={subscribed ? "secondary" : "outline"}
              disabled={subscribePending}
              aria-pressed={subscribed}
              onClick={() => void onToggleSubscribe()}
            >
              {subscribed ? "已订阅" : "订阅系列"}
            </Button>
          ) : (
            <span className="text-meta text-muted-foreground">订阅状态不可用</span>
          )}
          {subscribeError ? (
            <span role="alert" className="text-meta text-destructive">
              {subscribeError}
            </span>
          ) : null}
        </div>
      </header>

      {/*
        The chapter list is this page's P0, so it builds its own structure
        instead of using `PageSection`. That component's own header says so:
        "a reader with a table of contents … should build its own structure from
        the tokens instead" — its anatomy (18px heading + 13px count +
        description + one trailing action) is built for sibling sections, and a
        catalogue is not a section of anything. The tokens it would have
        supplied are used directly: `text-title` heading, `text-meta
        tabular-nums` count.
      */}
      <section
        id="series-chapters"
        aria-labelledby="series-chapters-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-baseline gap-2">
          <h2 id="series-chapters-heading" className="text-title font-semibold text-primary">
            章节目录
          </h2>
          <span className="text-meta tabular-nums text-muted-foreground">{chapters.length}</span>
        </div>

        {chapters.length === 0 ? (
          <PageState kind="empty" title="暂无章节" description="章节发布后会显示在这里。" />
        ) : (
          /*
            Each row is ONE link, not a link inside a row.

            The row was `li.flex items-center gap-4 px-4 py-3` with the title
            wrapped in an `<a>` — so the 32px of horizontal padding and the
            ordinal were dead space, and only the few characters of a title were
            clickable. The number is `aria-hidden` because it is a visual
            ordinal the title already states ("第一章"), which keeps the link's
            accessible name exactly the title.

            The destination stays the article, deliberately. `/series/:id/read`
            takes only `seriesId`, so a specific chapter cannot be addressed
            there; and a catalogue entry answers "show me this one", not
            "continue from here" — `开始阅读` above is the continuous path.
          */
          <ol className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
            {chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className="transition-colors first:rounded-t-[11px] last:rounded-b-[11px] hover:bg-muted/35"
              >
                <Link
                  to={`/articles/${encodeURIComponent(chapter.articleId)}`}
                  className="group focus-ring flex items-center gap-4 px-4 py-3.5"
                >
                  <span
                    aria-hidden
                    className="font-mono text-sm tabular-nums text-muted-foreground/70"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {/* Prefer the API title and retain a positional fallback for
                      legacy or unavailable search documents. */}
                  <span className="min-w-0 flex-1 text-[15px] font-medium text-foreground transition-colors group-hover:text-accent-strong">
                    {chapter.title?.trim() || `第 ${chapter.position} 章`}
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
