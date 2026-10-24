import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  Library,
  PenLine,
  Sparkles,
} from "lucide-react";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type {
  PublicSeriesDetail,
  PublicSeriesSummary,
  SeriesReadingProgress,
} from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesCover } from "@/components/visual/SeriesCover";
import { useAuth } from "@/features/auth/auth.store";
import readingNook from "@/assets/series-reading-nook.webp";
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

/*
 * The discovery panels read the public catalogue in one request and split it
 * locally. That is a deliberate trade: there is no "series by this author"
 * endpoint, and the public collection is small enough that one bounded page
 * covers it. When it outgrows `listPublic`'s limit the split silently thins out
 * instead of erroring — so the panels treat "few items" as normal, not as a
 * failure worth alarming the reader about.
 */
type DiscoverState =
  { kind: "loading" } | { kind: "failed" } | { kind: "ready"; all: PublicSeriesSummary[] };

const DISCOVER_LIMIT = 50;
const PANEL_ITEM_LIMIT = 3;

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

function authorLabel(series: PublicSeriesSummary | PublicSeriesDetail): string {
  return series.author.displayName?.trim() || `@${series.author.username}`;
}

/**
 * Public series detail — the WORK page (V4 layout).
 *
 * Backend: GET /api/v1/series/{id} -> PublicSeriesDetail, 404 for a missing or
 * non-ACTIVE series. Chapters come back ordered by `position`.
 *
 * The page is a work head plus its catalogue, with a discovery rail beside it:
 *
 *   head       the jacket, the work's facts, the primary action, and the
 *              reader's position — one band, read left to right
 *   catalogue  the chapters, as a single card of hairline rows
 *   rail       the author's other works and related series, both described as
 *              offers rather than requirements: each panel can be empty or
 *              unreadable without touching the work itself
 *
 * Reading is the P1 action; subscribing is secondary and independent of
 * progress — a reader who never subscribes can still resume.
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
  const [discover, setDiscover] = useState<DiscoverState>({ kind: "loading" });
  /* Bumping the key replays the load effects — the retry mechanism for the
     error branch below. The effects keep their per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  /* The rail has its own reload: retrying a failed panel must not refetch the
     work and throw away the reader's scroll position. */
  const [discoverKey, setDiscoverKey] = useState(0);

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

  /*
   * Fired in parallel with the work itself: the rail does not need to know
   * which series we are on to download the catalogue, and waiting for the
   * series would serialise two independent reads.
   */
  useEffect(() => {
    let active = true;
    setDiscover({ kind: "loading" });
    seriesApi
      .listPublic(DISCOVER_LIMIT)
      .then((items) => {
        if (!active) return;
        setDiscover({ kind: "ready", all: items ?? [] });
      })
      .catch(() => {
        if (!active) return;
        setDiscover({ kind: "failed" });
      });
    return () => {
      active = false;
    };
  }, [discoverKey]);

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
   * The position answers "where am I in this work" for every viewer, so it is
   * never blank: a guest is told the position is not recorded yet, a signed-in
   * reader with no history is told they have not started. Only the recorded
   * case names a chapter number — the backend knows the chapter, not the offset
   * inside it.
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

  /*
   * The rail splits one catalogue into two questions: "what else did this
   * author write" and "what else is worth reading". Both exclude the work we
   * are already on — offering the current page is not a suggestion.
   */
  const catalogue = discover.kind === "ready" ? discover.all : [];
  const others = catalogue
    .filter((item) => item.id !== series.id && item.author.username === series.author.username)
    .slice(0, PANEL_ITEM_LIMIT);
  const related = catalogue
    .filter((item) => item.id !== series.id && item.author.username !== series.author.username)
    .slice(0, PANEL_ITEM_LIMIT);

  const authorName = authorLabel(series);
  const authorInitial = authorName.replace(/^@/, "").charAt(0).toUpperCase();

  return (
    <article className="series-detail-page">
      <nav aria-label="面包屑" className="series-detail-crumb text-muted-foreground">
        <Link
          to="/series"
          className="focus-ring rounded-sm transition-colors hover:text-accent-strong"
        >
          系列广场
        </Link>
        <span aria-hidden className="text-border">
          /
        </span>
        <span className="text-foreground">{series.title}</span>
      </nav>

      <div className="series-detail-grid">
        <div className="series-detail-main">
          {/*
            One band, three columns: the jacket, the facts, the illustration.
            The illustration is the third column only while there is room for
            it; below 1290px it becomes a watermark and below 650px it is gone,
            because at that width it would sit on top of the copy it is meant to
            warm up.
          */}
          <section className="series-detail-head" aria-label="当前系列">
            <div className="series-detail-cover">
              <SeriesCover
                stableKey={`${series.id}:${series.slug}`}
                title={series.title}
                variant="jacket"
              />
            </div>

            <div className="series-detail-intro">
              <p className="eyebrow">星语系列 · SERIES</p>

              <h1 className="series-detail-title font-display font-extrabold text-primary">
                {series.title}
              </h1>

              {/* Who wrote it and how long it is are the same kind of fact —
                  one line, one weight, both true. No lifecycle status is shown:
                  ACTIVE is not "连载中" and ARCHIVED is not "完结". */}
              <div className="series-detail-meta text-muted-foreground">
                <Link
                  to={`/u/${encodeURIComponent(series.author.username)}`}
                  className="focus-ring rounded-sm font-semibold text-foreground transition-colors hover:text-accent-strong"
                >
                  {authorName}
                </Link>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <span className="tabular-nums">{`共 ${chapters.length} 章`}</span>
              </div>

              <p className="series-detail-description text-foreground-soft">
                {series.description || "该系列暂未提供简介。"}
              </p>

              <div className="series-detail-actions">
                {chapters.length > 0 ? (
                  <Button asChild className="h-[42px] px-[17px] text-sm">
                    <Link to={readHref}>
                      {resumeArticleId ? "继续阅读" : "开始阅读"}
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}

                {/* A guest still sees the subscribe slot: it is the second of
                    two buttons, so it takes the second button's shape rather
                    than shrinking to a text link next to the primary. */}
                {!isAuthenticated ? (
                  <Button asChild variant="outline" className="h-[42px] px-[17px] text-sm">
                    <Link to={`/login?returnTo=${encodeURIComponent(`/series/${series.id}`)}`}>
                      登录后订阅
                    </Link>
                  </Button>
                ) : subscribed !== null ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-[42px] px-[17px] text-sm"
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

              {/* A failed toggle is not a page error: it belongs to the control
                  that caused it, and it must be announced. */}
              {subscribeError ? (
                <p role="alert" className="mt-2 text-meta text-destructive">
                  {subscribeError}
                </p>
              ) : null}

              <p className="series-detail-hint text-muted-foreground">{positionLine}</p>

              {resumePercent !== null ? (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={resumeChapterCount}
                  aria-valuenow={resumeIndex ?? 0}
                  aria-label={`已读到第 ${resumeIndex} 章，共 ${resumeChapterCount} 章`}
                  className="series-detail-meter"
                >
                  <div
                    className="series-detail-meter-fill"
                    style={{ width: `${resumePercent}%` }}
                  />
                </div>
              ) : null}
            </div>

            <div className="series-detail-hero-art" aria-hidden="true">
              <img data-testid="series-reading-nook" src={readingNook} alt="" />
            </div>
          </section>

          {/*
            The catalogue is this page's P0, so it builds its own structure
            instead of using `PageSection`: a catalogue is not a section of
            another page's content, and the tokens it needs (title step, meta
            count, hairline rows inside one card) are used directly.
          */}
          <section
            id="series-chapters"
            className="series-detail-chapters"
            aria-labelledby="series-chapters-heading"
          >
            <div className="series-detail-chapters-head">
              <h2
                id="series-chapters-heading"
                className="text-[21px] font-bold tracking-[-0.5px] text-primary"
              >
                章节目录
                <span className="ml-2 text-[12px] font-normal tabular-nums text-muted-foreground/80">
                  {String(chapters.length).padStart(2, "0")} 章
                </span>
              </h2>
              <p className="hidden text-[12px] text-muted-foreground/80 sm:block">
                按作者编排顺序阅读
              </p>
            </div>

            {chapters.length === 0 ? (
              <PageState kind="empty" title="暂无章节" description="章节发布后会显示在这里。" />
            ) : (
              /*
                Each row is ONE link. The destination is the series reader at
                that chapter (`?chapter=<articleId>`), so a catalogue entry keeps
                the reader inside the work and lets them highlight, refresh and
                share the exact chapter. The ordinal is `aria-hidden` because the
                title already states it ("第一章"); the resume marker is not, so a
                screen reader hears where the reader left off.
              */
              <ol className="series-detail-chapter-list">
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
                          <span className="block text-[15px] font-semibold leading-[1.6] text-foreground">
                            {chapter.title?.trim() || `第 ${chapter.position} 章`}
                          </span>
                          {isResume ? (
                            <span className="series-detail-notice text-accent-strong">
                              上次阅读
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight
                          aria-hidden
                          className="series-detail-chevron h-5 w-5 text-accent-strong/70"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}

            {chapters.length > 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground/80">
                点击章节后，将在系列阅读器中打开对应内容。
              </p>
            ) : null}
          </section>
        </div>

        {/*
          The rail is an offer, not a requirement: every panel states its own
          health and can be retried on its own. Nothing here may block the work,
          which is why the failure copy says so out loud.
        */}
        <aside className="series-detail-side" aria-label="延伸发现">
          <section className="series-detail-panel" aria-labelledby="series-author-panel">
            <div className="series-detail-panel-head">
              <h2
                id="series-author-panel"
                className="flex items-center gap-2 text-[17px] font-bold text-primary"
              >
                <PenLine aria-hidden className="h-4 w-4 text-accent-strong" />
                创作者的更多系列
              </h2>
              <Link
                to={`/u/${encodeURIComponent(series.author.username)}`}
                className="focus-ring shrink-0 rounded-sm text-[12px] text-accent-strong hover:underline"
              >
                创作者主页 ↗
              </Link>
            </div>

            <div className="mt-[17px] flex items-center gap-3">
              {series.author.avatar ? (
                <img
                  src={series.author.avatar}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full border-2 border-card object-cover ring-1 ring-border"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-card bg-primary text-[21px] font-bold text-primary-foreground ring-1 ring-border"
                >
                  {authorInitial}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-primary">{authorName}</div>
                <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
                  当前系列创作者 · 更多分享与个人介绍
                </p>
              </div>
            </div>

            <div aria-live="polite">
              {discover.kind === "loading" ? (
                <p className="mt-4 text-[12px] text-muted-foreground">正在读取其他系列…</p>
              ) : discover.kind === "failed" ? (
                <EmptyPanel
                  icon={<AlertCircle className="h-[18px] w-[18px]" />}
                  tone="error"
                  title="暂时无法加载，请重试。"
                  description="创作者信息仍可正常查看。"
                  onRetry={() => setDiscoverKey((key) => key + 1)}
                />
              ) : others.length === 0 ? (
                <EmptyPanel
                  icon={<Library className="h-[18px] w-[18px]" />}
                  title="暂时还没有其他公开系列"
                  description="也可以前往创作者主页，了解更多分享。"
                />
              ) : (
                <div className="series-detail-panel-list">
                  {others.map((item) => (
                    <WorkRow key={item.id} item={item} subtitle={`共 ${item.chapterCount} 章`} />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="series-detail-panel" aria-labelledby="series-related-panel">
            <div className="series-detail-panel-head items-start">
              <div className="min-w-0">
                <h2
                  id="series-related-panel"
                  className="flex items-center gap-2 text-[17px] font-bold text-primary"
                >
                  <Sparkles aria-hidden className="h-4 w-4 text-accent-strong" />
                  继续探索
                </h2>
                {/*
                  The blurb says what this panel actually is. It reads the public
                  series list and splits it by author, so there is no relevance
                  ranking behind the door and the copy must not imply one.
                */}
                <p className="mt-1 text-[12px] leading-6 text-muted-foreground">
                  发现更多值得阅读的系列。
                </p>
              </div>
              <Link
                to="/series"
                className="focus-ring mt-0.5 shrink-0 rounded-sm text-[12px] text-accent-strong hover:underline"
              >
                全部系列 ↗
              </Link>
            </div>

            <div aria-live="polite">
              {discover.kind === "loading" ? (
                <p className="mt-4 text-[12px] text-muted-foreground">正在读取公开系列…</p>
              ) : discover.kind === "failed" ? (
                <EmptyPanel
                  icon={<AlertCircle className="h-[18px] w-[18px]" />}
                  tone="error"
                  title="暂时无法加载，请重试。"
                  description="不影响当前系列的阅读。"
                  onRetry={() => setDiscoverKey((key) => key + 1)}
                />
              ) : related.length === 0 ? (
                <EmptyPanel
                  icon={<Compass className="h-[18px] w-[18px]" />}
                  title="暂时没有更多公开系列"
                  description="可以返回系列列表继续浏览。"
                />
              ) : (
                <div className="series-detail-panel-list">
                  {related.map((item) => (
                    <WorkRow
                      key={item.id}
                      item={item}
                      subtitle={`${authorLabel(item)} · 共 ${item.chapterCount} 章`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}

/**
 * One series in a rail panel: the cover, the title, one supporting line.
 *
 * The whole row is the link — there is no nested control — and the cover is
 * the shared `SeriesCover` poster, so a series wears the same jacket here as it
 * does in the plaza and in the panel's own head.
 */
function WorkRow({ item, subtitle }: { item: PublicSeriesSummary; subtitle: string }) {
  return (
    <Link
      to={`/series/${encodeURIComponent(item.id)}`}
      data-testid="series-rail-item"
      className="series-detail-work-row group focus-ring rounded-sm"
    >
      <SeriesCover
        stableKey={`${item.id}:${item.slug}`}
        title={item.title}
        variant="poster"
        className="w-[41px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-primary transition-colors group-hover:text-accent-strong">
          {item.title}
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <span aria-hidden className="shrink-0 pl-1 text-[23px] text-muted-foreground/60">
        ›
      </span>
    </Link>
  );
}

/**
 * A rail panel with nothing to show.
 *
 * Two different things wear the same box: "there is nothing here" (a dashed
 * neutral frame — the shelf is empty) and "this could not be read" (a warmer
 * frame and a retry, because the difference matters to a reader deciding
 * whether to refresh). Neither is a page error, so neither uses `PageState`.
 */
function EmptyPanel({
  icon,
  tone,
  title,
  description,
  onRetry,
}: {
  icon: ReactNode;
  tone?: "error";
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="series-detail-blank" data-tone={tone} role={tone ? "alert" : "status"}>
      <span aria-hidden className="series-detail-blank-icon">
        {icon}
      </span>
      <strong className="block text-[13px] font-semibold text-primary">{title}</strong>
      <p className="mx-auto mt-[7px] max-w-[25ch] text-[12px] leading-7 text-muted-foreground">
        {description}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring mt-2.5 rounded-lg border border-accent-line bg-card px-3.5 py-2 text-[12px] text-accent-strong transition-colors hover:border-accent/60"
        >
          重试加载
        </button>
      ) : null}
    </div>
  );
}
