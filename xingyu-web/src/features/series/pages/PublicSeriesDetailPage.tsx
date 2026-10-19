import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail, SeriesReadingProgress } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesCover } from "@/components/visual/SeriesCover";
import { useAuth } from "@/features/auth/auth.store";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; series: PublicSeriesDetail };

/*
 * The private progress read has its own lifecycle, separate from the public
 * series: a failure here must never stop a guest or a signed-in reader from
 * opening the work, and "no record" is not an error.
 */
type ProgressState = "idle" | "loading" | "ready" | "error";

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Public series detail — the WORK page (Phase 2G; work layout + resume, Phase 3).
 *
 * Backend: GET /api/v1/series/{id} -> PublicSeriesDetail, 404 for a missing or
 * non-ACTIVE series. Chapters come back ordered by `position`.
 *
 * Information order is the reader's: breadcrumb → work introduction (cover,
 * title, author, length, blurb) → the primary reading action → the chapter
 * catalogue. Reading is the P1 action; subscribing is secondary and independent
 * of progress — a reader who never subscribes can still resume.
 *
 * The resume position comes from `GET /me/series/{id}/reading-progress` only
 * for a signed-in viewer. It is a chapter reference, never a percentage: the
 * backend stores the last-read article and nothing about how far into it the
 * reader got. When the recorded chapter no longer exists or is unreadable the
 * endpoint omits it, and this page falls back to "开始阅读" without inventing a
 * chapter number.
 *
 * Chapter rows open the series reader at that chapter
 * (`/series/:id/read?chapter=<articleId>`), not the standalone article page, so
 * the reader stays inside the work.
 *
 * Subscription: `hasSubscribed` is viewer-scoped (true/false signed in, null for
 * guests), so the control starts in the right state after a refresh. Toggle uses
 * optimistic update + duplicate-click guard + snapshot rollback.
 */
export function PublicSeriesDetailPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [subscribePending, setSubscribePending] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SeriesReadingProgress | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>("idle");
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branch below. The effects keep their per-run `active` guard. */
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

  useEffect(() => {
    if (!seriesId || !isAuthenticated) {
      /* Guests have no private progress and must not ask for it. */
      setProgress(null);
      setProgressState("idle");
      return;
    }
    let active = true;
    setProgressState("loading");
    seriesApi
      .getReadingProgress(seriesId)
      .then((data) => {
        if (!active) return;
        setProgress(data);
        setProgressState("ready");
      })
      .catch(() => {
        if (!active) return;
        /* A failed read degrades to "no resume" — never blocks the work. */
        setProgress(null);
        setProgressState("error");
      });
    return () => {
      active = false;
    };
  }, [seriesId, isAuthenticated, reloadKey]);

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

  const resumeArticleId = progress?.readingHistoryEnabled === false
    ? null
    : (progress?.chapterArticleId ?? null);
  const resumeIndex = resumeArticleId ? (progress?.chapterIndex ?? null) : null;
  const readHref = resumeArticleId
    ? `/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(resumeArticleId)}`
    : `/series/${encodeURIComponent(series.id)}/read`;

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
        The work introduction: cover + facts, no framed panel.
        ============================================================
        A `p-6` card here would announce "here is a summary, the content starts
        below" and stack a second white rectangle on a page whose real structure
        is one work. The cover carries the identity (same `SeriesCover` and the
        same stable key as the plaza card, so a series looks like itself in both
        places), and the text column reads as the jacket.

        On a phone the cover scales to 112px and sits above the text; from `sm`
        it moves beside it. The blurb keeps a 68ch measure on desktop rather than
        running the full shell width.
      */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <SeriesCover
          stableKey={`${series.id}:${series.slug}`}
          title={series.title}
          variant="poster"
          className="w-[112px] shrink-0 sm:w-[144px] lg:w-[168px]"
        />

        <div className="min-w-0 flex-1">
          <h1 className="text-display font-semibold tracking-tight text-primary">
            {series.title}
          </h1>

          {/* Who wrote it and how long it is are the same kind of fact — one
              line, one weight, both true. No lifecycle status is shown: ACTIVE
              is not "连载中" and ARCHIVED is not "完结". */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted-foreground">
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

          <p className="mt-4 max-w-[68ch] text-[15px] leading-7 text-muted-foreground">
            {series.description || "该系列暂未提供简介。"}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {chapters.length > 0 ? (
              <Button asChild>
                <Link to={readHref}>{resumeArticleId ? "继续阅读" : "开始阅读"}</Link>
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

          {/* The chapter, not a percentage: `series_reader_state` knows the last
              chapter opened and nothing about the position inside it. */}
          {resumeArticleId && resumeIndex !== null ? (
            <p className="mt-2 text-meta tabular-nums text-muted-foreground">
              {`上次读到第 ${resumeIndex} / ${progress?.chapterCount ?? chapters.length} 章`}
            </p>
          ) : null}
          {/* A failed progress read never blocks the work, but it is not the
              same fact as "no progress" — say so quietly instead of pretending. */}
          {progressState === "error" ? (
            <p className="mt-2 text-meta text-muted-foreground">阅读进度暂时无法读取</p>
          ) : null}
        </div>
      </header>

      {/*
        The chapter list is this page's P0, so it builds its own structure
        instead of using `PageSection`: a catalogue is not a section of another
        page's content, and the tokens it needs (title step, meta count,
        hairline rows) are used directly.
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
            Each row is ONE link. The destination is the series reader at that
            chapter (`?chapter=<articleId>`), so a catalogue entry keeps the
            reader inside the work and the reader can highlight, refresh and
            share the exact chapter. The ordinal is `aria-hidden` because the
            title already states it ("第一章"); the link's accessible name stays
            the chapter title.
          */
          <ol className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
            {chapters.map((chapter, index) => (
              <li
                key={chapter.id}
                className="transition-colors first:rounded-t-[11px] last:rounded-b-[11px] hover:bg-muted/35"
              >
                <Link
                  to={`/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(chapter.articleId)}`}
                  className="group focus-ring flex items-center gap-4 px-4 py-3.5"
                >
                  <span
                    aria-hidden
                    className="font-mono text-sm tabular-nums text-muted-foreground/70"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
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
