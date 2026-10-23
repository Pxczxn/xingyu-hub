import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail, SeriesReadingProgress } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesCover } from "@/components/visual/SeriesCover";
import { useAuth } from "@/features/auth/auth.store";
import "../series-detail.css";

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
 * The page is a jacket and its table of contents: the reading copy on the left
 * (with the reader's own position recorded under it), the work's facts and the
 * primary action on the right, then the catalogue as hairline rows. Reading is
 * the P1 action; subscribing is secondary and independent of progress — a
 * reader who never subscribes can still resume.
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

  const resumeArticleId =
    progress?.readingHistoryEnabled === false ? null : (progress?.chapterArticleId ?? null);
  const resumeIndex = resumeArticleId ? (progress?.chapterIndex ?? null) : null;
  const readHref = resumeArticleId
    ? `/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(resumeArticleId)}`
    : `/series/${encodeURIComponent(series.id)}/read`;

  /*
   * The position under the jacket answers "where am I in this work" for every
   * viewer, so it is never blank: a guest is told the position is not recorded
   * yet, a signed-in reader with no history is told they have not started. Only
   * the recorded case names a chapter number — the backend knows the chapter,
   * not the offset inside it.
   */
  const positionLine =
    resumeArticleId && resumeIndex !== null
      ? `上次读到第 ${resumeIndex} / ${progress?.chapterCount ?? chapters.length} 章`
      : progressState === "error"
        ? "阅读进度暂时无法读取"
        : !isAuthenticated
          ? "登录后记录阅读位置"
          : progressState === "loading"
            ? "正在读取阅读进度"
            : "尚未开始阅读";

  /*
   * The bar counts chapters read, so it only exists when a chapter is recorded:
   * an empty track for a guest would assert 0% progress the backend never made.
   * No percentage is printed anywhere — the sentence above already says "第 2 / 2
   * 章", and repeating it as "100%" would say the same thing twice.
   */
  const resumeChapterCount = resumeIndex !== null ? (progress?.chapterCount ?? chapters.length) : 0;
  const resumePercent =
    resumeIndex !== null && resumeChapterCount > 0
      ? Math.min(100, Math.round((resumeIndex / resumeChapterCount) * 100))
      : null;

  return (
    <article>
      <nav aria-label="面包屑" className="series-detail-crumb text-meta text-muted-foreground">
        <Link
          to="/series"
          className="focus-ring rounded-sm transition-colors hover:text-accent-strong"
        >
          系列广场
        </Link>
        <span aria-hidden className="mx-2 text-border">
          ／
        </span>
        <span className="text-foreground">{series.title}</span>
      </nav>

      {/*
        Jacket on the left, facts on the right — one work, not a summary card.
        ============================================================
        A `p-6` panel around the introduction would announce "here is a summary,
        the content starts below" and stack a second white rectangle on a page
        whose real shape is a single book. The cover carries the identity (same
        `SeriesCover` key as the plaza card, so a series looks like itself in
        both places) and the caption under it is the reader's bookmark in this
        copy, which is why it belongs beside the jacket and not with the facts.
      */}
      <div className="series-detail-layout">
        <aside className="series-detail-jacket-col">
          <SeriesCover
            stableKey={`${series.id}:${series.slug}`}
            title={series.title}
            variant="jacket"
            className="series-detail-jacket"
          />
          <div className="series-detail-caption">
            <span className="series-detail-caption-label">阅读位置</span>
            <span className="block tabular-nums">{positionLine}</span>
            {resumePercent !== null ? (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={resumeChapterCount}
                aria-valuenow={resumeIndex ?? 0}
                aria-label={`已读到第 ${resumeIndex} 章，共 ${resumeChapterCount} 章`}
                className="series-detail-meter"
              >
                <div className="series-detail-meter-fill" style={{ width: `${resumePercent}%` }} />
              </div>
            ) : null}
          </div>
        </aside>

        <section className="min-w-0">
          <p className="eyebrow">星语系列 · SERIES</p>

          <h1 className="font-display mt-[19px] text-[2.05rem] font-extrabold leading-[1.22] tracking-[-0.045em] text-primary sm:text-[2.4375rem]">
            {series.title}
          </h1>

          {/* Who wrote it and how long it is are the same kind of fact — one
              line, one weight, both true. No lifecycle status is shown: ACTIVE
              is not "连载中" and ARCHIVED is not "完结". */}
          <div className="mt-[18px] flex flex-wrap items-center gap-x-[15px] gap-y-1 text-[14px] text-muted-foreground">
            <Link
              to={`/u/${encodeURIComponent(series.author.username)}`}
              className="focus-ring rounded-sm font-semibold text-foreground transition-colors hover:text-accent-strong"
            >
              {series.author.displayName?.trim() || `@${series.author.username}`}
            </Link>
            <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-muted-foreground/35" />
            <span className="tabular-nums">{`共 ${chapters.length} 章`}</span>
          </div>

          <p className="mt-[23px] max-w-[650px] text-[16px] leading-[1.9] text-foreground-soft">
            {series.description || "该系列暂未提供简介。"}
          </p>

          <div className="mt-[24px] flex flex-wrap items-center gap-[13px]">
            {chapters.length > 0 ? (
              <Button asChild className="h-11 px-6 text-sm">
                <Link to={readHref}>
                  {resumeArticleId ? "继续阅读" : "开始阅读"}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}

            {/* A guest still sees the subscribe slot: it is the second of two
                buttons, so it takes the second button's shape rather than
                shrinking to a text link next to a 44px primary. */}
            {!isAuthenticated ? (
              <Button asChild variant="outline" className="h-11 px-5 text-sm">
                <Link to={`/login?returnTo=${encodeURIComponent(`/series/${series.id}`)}`}>
                  登录后订阅
                </Link>
              </Button>
            ) : subscribed !== null ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 px-5 text-sm"
                disabled={subscribePending}
                aria-pressed={subscribed}
                onClick={() => void onToggleSubscribe()}
              >
                {subscribed ? <Check aria-hidden className="h-4 w-4" /> : null}
                {subscribed ? "已订阅" : "订阅系列"}
              </Button>
            ) : (
              <span className="text-meta text-muted-foreground">订阅状态不可用</span>
            )}
          </div>

          {/* A failed toggle is not a page error: it belongs to the control that
              caused it, and it must be announced. */}
          {subscribeError ? (
            <p role="alert" className="mt-2 text-meta text-destructive">
              {subscribeError}
            </p>
          ) : null}

          <hr className="series-detail-sep" />

          {/*
            The catalogue is this page's P0, so it builds its own structure
            instead of using `PageSection`: a catalogue is not a section of
            another page's content, and the tokens it needs (title step, meta
            count, hairline rows) are used directly.
          */}
          <section id="series-chapters" aria-labelledby="series-chapters-heading">
            <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2
                id="series-chapters-heading"
                className="text-[21px] font-bold tracking-[-0.5px] text-primary"
              >
                章节目录
                <span className="ml-2 text-[13px] font-normal tabular-nums text-muted-foreground/70">
                  {String(chapters.length).padStart(2, "0")}
                </span>
              </h2>
              <p className="text-[12px] text-muted-foreground/80">按作者编排顺序阅读</p>
            </div>

            {chapters.length === 0 ? (
              <PageState kind="empty" title="暂无章节" description="章节发布后会显示在这里。" />
            ) : (
              /*
                Each row is ONE link. The destination is the series reader at
                that chapter (`?chapter=<articleId>`), so a catalogue entry
                keeps the reader inside the work and the reader can highlight,
                refresh and share the exact chapter. The ordinal is
                `aria-hidden` because the title already states it ("第一章");
                the resume marker is not, so a screen reader hears where the
                reader left off.
              */
              <ol>
                {chapters.map((chapter, index) => {
                  const isResume =
                    resumeArticleId !== null && chapter.articleId === resumeArticleId;
                  return (
                    <li
                      key={chapter.id}
                      className="series-detail-chapter"
                      data-active={isResume ? "true" : undefined}
                    >
                      <Link
                        to={`/series/${encodeURIComponent(series.id)}/read?chapter=${encodeURIComponent(chapter.articleId)}`}
                        className="series-detail-chapter-link focus-ring"
                      >
                        <span aria-hidden className="series-detail-ordinal">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15.5px] font-semibold leading-[1.6] text-foreground">
                            {chapter.title?.trim() || `第 ${chapter.position} 章`}
                          </span>
                          {isResume ? <span className="series-detail-notice">上次阅读</span> : null}
                        </span>
                        <ArrowUpRight
                          aria-hidden
                          className="series-detail-arrow h-[18px] w-[18px]"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}

            {chapters.length > 0 ? (
              <p className="series-detail-footnote mt-[18px] text-[12px] text-muted-foreground/80">
                选择章节后，将在系列阅读器中打开对应内容。
              </p>
            ) : null}
          </section>
        </section>
      </div>
    </article>
  );
}
