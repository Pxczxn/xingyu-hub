import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { ArticleMarkdownBody } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/auth.store";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; series: PublicSeriesDetail };

/*
  Reading measures, in `ch` rather than px.
  ============================================================
  They were 680 / 820 / 960 px, which is wrong on two counts:

  1. A px measure and a px font size do not compose. At 18px/680px a line runs
     ~38 CJK glyphs; raise the font to 24px and the same column drops to ~28,
     lower it to 15px and it climbs to ~45. The reader's A- / A+ control was
     silently changing how many glyphs fit on a line, which is the one thing a
     reading-width control exists to hold steady. `ch` scales with the font, so
     58/68/80 `ch` stay ~29/34/40 glyphs at every size.
  2. `960` could never be reached: at a 1200px shell the article column is
     1200 − 256 (rail) − 24 (gap) = 920px, so "宽" silently meant "medium plus
     whatever was left". A control whose label promises something the layout
     cannot deliver is worse than no control.

  `68ch` is the default because it is the SAME measure the article page uses
  (`max-w-[68ch]` in ArticleDetailPage) — which is what this file's header has
  always claimed ("a chapter reads identically to the article") and what the px
  values did not actually deliver.

  At 24px the 80ch option exceeds the 920px column and is capped by it. That is
  the honest ceiling: the column is the hard limit, the setting is a preference
  within it.
*/
const LAYOUTS = [
  ["narrow", "窄", "58ch"],
  ["medium", "适中", "68ch"],
  ["wide", "宽", "80ch"],
] as const;

type LayoutKey = (typeof LAYOUTS)[number][0];

/*
  The font scale, named because the bound is used twice per button — once to
  clamp the click and once to disable it. Two copies of a literal is how the
  button and the clamp drift apart.

  `15` is the article page's own body size (`text-[15px]` in `.article-body`),
  so it is the floor the reader can return to; the default sits at 18 because
  this is the continuous-reading surface and comfort outranks parity here.
*/
const MIN_FONT_SIZE = 15;
const MAX_FONT_SIZE = 24;

function isNotFound(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND")
  );
}

/**
 * Series reader (Phase 2G; deep links + progress Phase 3, 2026-10-19).
 *
 * Loads the public series, sorts chapters by `position`, and renders the
 * selected chapter's article through the migrated Legacy reading pipeline
 * (ArticleMarkdownBody + prepareArticleBodyForRead) — the same renderer the
 * article detail page uses.
 *
 * The selected chapter lives in the URL (`?chapter=<articleId>`), so a link
 * can point at chapter 4, refresh keeps it, and back/forward retraces the
 * reading path. An unknown id degrades to the first chapter with a notice and
 * can never select an article that is not a chapter of this series.
 *
 * "A chapter reads identically to the article" was the old claim here, and it
 * was half true: the renderer and the measure match (both default to 68ch), but
 * the size does not. The article page sets its body at 15px because it is a
 * community page with a rail competing for the same shell; this is a dedicated
 * continuous-reading surface, so it opens at 18px and hands the reader a control
 * to move it. Same typesetting, one step larger by default — stated rather than
 * assumed, since the difference is deliberate.
 *
 * Reading progress is written to POST /api/v1/me/reading-progress once a
 * chapter has actually loaded (not when a button is pressed), for signed-in
 * readers only. The backend owns validation and the history toggle; a failed
 * write is swallowed because it must never interrupt reading.
 */
export function PublicSeriesReadPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  /*
   * The chapter is URL state, not component state.
   *
   * `?chapter=<articleId>` is the deep-link contract: it survives refresh,
   * sharing, and browser back/forward. The article id is used instead of the
   * positional index because positions are editorial order — reordering the
   * catalogue must not silently retarget an old shared link.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [fontSize, setFontSize] = useState(18);
  const [layout, setLayout] = useState<LayoutKey>("medium");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [articleState, setArticleState] = useState<"idle" | "loading" | "error">("idle");
  /* Bumping either key replays its load effect — the retry mechanism for the
     two error branches below. Both effects keep their per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  const [articleReloadKey, setArticleReloadKey] = useState(0);
  /* Which chapter's progress has already been written in this mount. Keyed by
     series + article: the same article can belong to more than one series, so
     an article id alone would suppress a legitimate write in the next series. */
  const recordedRef = useRef<string | null>(null);
  /* Previous chapter key, used to scroll to the top ONLY on a real switch. */
  const previousChapterRef = useRef<string | null>(null);

  useEffect(() => {
    if (!seriesId) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    seriesApi
      .getPublicById(seriesId)
      .then((series) => {
        if (active) setState({ kind: "ready", series });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({ kind: isNotFound(err) ? "unavailable" : "error" });
      });
    return () => {
      active = false;
    };
  }, [seriesId, reloadKey]);

  const chapters = useMemo(
    () =>
      state.kind === "ready"
        ? [...(state.series.chapters ?? [])].sort((a, b) => a.position - b.position)
        : [],
    [state],
  );

  const requestedArticleId = searchParams.get("chapter")?.trim() || null;
  const requestedIndex = requestedArticleId
    ? chapters.findIndex((chapter) => chapter.articleId === requestedArticleId)
    : -1;
  /* Until the series has loaded, `chapters` is empty for every URL — claiming
     "this chapter does not exist" before then would fire on every deep link. */
  const chapterNotFound =
    state.kind === "ready" && chapters.length > 0 && requestedArticleId !== null && requestedIndex < 0;
  /* An unknown/removed chapter degrades to the first chapter. It is never
     treated as a valid index, so a forged `?chapter=` cannot select an article
     from another series (or anything outside `chapters` at all). */
  const currentIndex = requestedIndex >= 0 ? requestedIndex : 0;
  const current = chapters[currentIndex] ?? chapters[0];
  /* The effect identity. Depending on the object would re-run every render. */
  const currentArticleId = current?.articleId ?? null;

  useEffect(() => {
    if (!currentArticleId) {
      setArticle(null);
      setArticleState("idle");
      return;
    }
    let active = true;
    /* Drop the previous chapter IMMEDIATELY. Keeping it on screen while the new
       article loads would show the old body and heading under the new counter. */
    setArticle(null);
    setArticleState("loading");
    articlesApi
      .getArticle(currentArticleId)
      .then((data) => {
        if (!active) return;
        setArticle(data);
        setArticleState("idle");
      })
      .catch(() => {
        if (!active) return;
        setArticle(null);
        setArticleState("error");
      });
    return () => {
      active = false;
    };
  }, [currentArticleId, articleReloadKey]);

  /* A chapter switch starts at the top of the new chapter. The first render is
     skipped: opening a link should honour the browser's own scroll position. */
  useEffect(() => {
    if (!currentArticleId) return;
    const key = `${seriesId}:${currentArticleId}`;
    const previous = previousChapterRef.current;
    previousChapterRef.current = key;
    if (previous !== null && previous !== key) {
      window.scrollTo(0, 0);
    }
  }, [seriesId, currentArticleId]);

  /*
   * Progress is written when a chapter has ACTUALLY loaded, not when a button
   * is pressed. That covers every entry path (first chapter, deep link, sidebar,
   * previous/next, bookmarks) with one rule, and it never records an article the
   * reader could not read.
   *
   * The write is deliberately best-effort: a failure must not interrupt reading.
   * If it fails, the marker is cleared so a later successful load of the same
   * chapter can retry; a successful write is not repeated for the same mount,
   * so re-renders cannot multiply requests.
   */
  useEffect(() => {
    if (!isAuthenticated || articleState !== "idle" || !article || !currentArticleId) return;
    if (article.id !== currentArticleId) return;
    const key = `${seriesId}:${article.id}`;
    if (recordedRef.current === key) return;
    recordedRef.current = key;
    void seriesApi.recordReadingProgress(seriesId, article.id).catch(() => {
      if (recordedRef.current === key) recordedRef.current = null;
    });
  }, [article, articleState, currentArticleId, isAuthenticated, seriesId]);

  function selectChapter(index: number) {
    const chapter = chapters[index];
    if (!chapter || index === currentIndex) return;
    setSearchParams({ chapter: chapter.articleId });
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
    return <PageState kind="empty" title="系列不存在或无权访问" />;
  }

  const { series } = state;
  /*
   * The article that is allowed on screen right now. A loaded article only
   * counts when it belongs to the selected chapter — the request for the
   * previous chapter can resolve after the reader has already moved on.
   */
  const visibleArticle = article && current && article.id === current.articleId ? article : null;
  const prepared = visibleArticle ? prepareArticleBodyForRead(visibleArticle.body) : null;
  const measure = LAYOUTS.find(([key]) => key === layout)?.[2] ?? "68ch";

  return (
    <div className="section-gap lg:flex lg:gap-6">
      {/*
        The chapter nav serves the body, so it travels with the reader.
        ============================================================
        §3.2 is explicit about this page: "系列阅读器的核心是连续阅读，左侧章节
        导航应该服务于正文，而不是跟正文争抢注意力." The nav used to scroll
        away with the page — by the time a reader is 3000px into chapter 4, the
        only control that could take them to chapter 5 is off screen, and they
        have to scroll back up to a list they have already read to get anywhere.

        `lg:self-start` is load-bearing, not decoration: a flex row stretches
        its items to the tallest one by default, so a full-height `<aside>` has
        zero travel left inside its own box and `sticky` silently does nothing.

        The inner scroll is the other half. A 40-chapter series makes a list
        taller than the viewport, and a sticky box taller than the viewport
        cannot stick either — its bottom would be unreachable. Capping the list
        at the available height lets it scroll on its own while the article
        keeps the main scrollbar.
      */}
      <aside className="lg:sticky lg:top-24 lg:z-20 lg:max-h-[calc(100vh-7rem)] lg:w-64 lg:shrink-0 lg:self-start lg:overflow-y-auto">
        <Link
          to={`/series/${encodeURIComponent(series.id)}`}
          className="focus-ring inline-flex items-center gap-1 rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          返回系列
        </Link>
        <h2 className="mt-3 text-base font-semibold text-primary">{series.title}</h2>
        <p className="text-meta tabular-nums text-muted-foreground">{`${chapters.length} 章`}</p>

        <nav aria-label="章节目录" className="mt-3">
          {/*
            Selected and hovered must not be the same surface.

            They were both `bg-muted` — one colour doing two jobs, so a reader
            moving the mouse down the list saw every row they passed look
            exactly like the chapter they were actually on. Selected is now the
            full-strength surface plus an accent bar plus the heavier weight;
            hover is half-strength. Four signals, none of them shared.

            `aria-current` rather than an `aria-label` rewrite: the button's
            accessible name stays the chapter title, which is what a screen
            reader user needs to hear, and the state is announced separately.
          */}
          <ol className="flex flex-col gap-0.5">
            {chapters.map((chapter, index) => {
              const isCurrent = index === currentIndex;
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    aria-current={isCurrent ? "true" : undefined}
                    onClick={() => selectChapter(index)}
                    className={cn(
                      "focus-ring relative flex w-full items-center gap-2 rounded-md py-2 pl-4 pr-3 text-left text-sm transition-colors",
                      isCurrent
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {isCurrent ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-1.5 w-0.5 rounded-full bg-accent"
                      />
                    ) : null}
                    <span
                      aria-hidden
                      className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {/* Prefer the loaded article title, then the chapter title
                        from the series contract, with a positional fallback. */}
                    <span className="min-w-0 flex-1 truncate">
                      {index === currentIndex && visibleArticle?.title
                        ? visibleArticle.title
                        : chapter.title?.trim() || `第 ${chapter.position} 章`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </aside>

      <article className="min-w-0 flex-1">
        {!current ? (
          <PageState
            kind="empty"
            title="暂无可阅读章节"
            description="该系列发布章节后会显示在这里。"
          />
        ) : (
          <>
            {chapterNotFound ? (
              <p
                role="status"
                className="mb-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-meta text-muted-foreground"
              >
                该章节不存在或已从系列中移除，已从第一章开始。
              </p>
            ) : null}

            {/*
              Reading controls: one quiet strip, two jobs, split by a hairline.

              Everything here was `text-xs` in a single undifferentiated row —
              the progress counter, the two font buttons and the three measure
              buttons all at the same weight, so nothing told the reader which
              parts were readouts and which were controls. The counter stays
              left because it answers "where am I"; the controls group right
              because they answer "how do I want this shown".

              The selected measure button was marked `text-accent` — gold text
              on cream, 2.01:1. That is the one thing this design system
              forbids: `--accent` is a FILL token (navy sits on it at 7.4:1),
              and gold TEXT resolves through `--accent-strong`. The active
              state now uses the three tokens built for exactly this job:
              `border-accent-line`, `bg-accent-soft`, `text-accent-strong`.
            */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-meta text-muted-foreground">
              <span className="tabular-nums">{`第 ${currentIndex + 1} / ${chapters.length} 章`}</span>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="减小字号"
                    disabled={fontSize <= MIN_FONT_SIZE}
                    onClick={() => setFontSize((value) => Math.max(MIN_FONT_SIZE, value - 1))}
                    className="focus-ring rounded border border-border px-2 py-0.5 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    A-
                  </button>
                  <span className="w-7 text-center tabular-nums">{fontSize}</span>
                  <button
                    type="button"
                    aria-label="增大字号"
                    disabled={fontSize >= MAX_FONT_SIZE}
                    onClick={() => setFontSize((value) => Math.min(MAX_FONT_SIZE, value + 1))}
                    className="focus-ring rounded border border-border px-2 py-0.5 transition-colors hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    A+
                  </button>
                </div>

                <span aria-hidden className="h-4 w-px bg-border" />

                {/* Mutually exclusive options, so `aria-pressed` on each — a
                    screen reader user hears "适中, pressed" rather than three
                    identical "适中" buttons with no state. */}
                <div role="group" aria-label="阅读宽度" className="flex items-center gap-1">
                  {LAYOUTS.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={layout === key}
                      onClick={() => setLayout(key)}
                      className={cn(
                        "focus-ring rounded border px-2 py-0.5 transition-colors",
                        layout === key
                          ? "border-accent-line bg-accent-soft font-medium text-accent-strong"
                          : "border-border hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/*
              One reading column, and it is left-aligned like the article page.

              Two things this wrapper does, and both are load-bearing:

              1. `reader-column` hands the reader's chosen size to the body's
                 type scale. `.article-body` carries a 15px default for every
                 other caller; inside this class it inherits instead, so one
                 value drives the paragraphs and the headings together.
              2. The inline `fontSize` is what makes `ch` mean anything here.
                 `ch` resolves against the ELEMENT'S OWN font-size, so a
                 `maxWidth` of `68ch` only holds ~constant glyphs per line while
                 it sits on the element that carries the reader's size. Move the
                 size to a child and the measure silently stops tracking.

              `mx-auto` is gone. It centred the text inside the article column,
              which put the text's left edge ~120px to the right of the control
              strip above it — controls and the thing they control, not sharing
              an edge. The article page never centred its column either, so
              dropping it here is also what makes the two pages line up.
            */}
            <div
              data-testid="reader-column"
              className="reader-column mt-6"
              style={{ fontSize, maxWidth: measure }}
            >
              <h1 className="text-display font-semibold tracking-tight text-primary">
                {/* Prefer the loaded chapter title; fall back to the series
                    contract's title (the API may omit it) or the position. */}
                {visibleArticle?.title
                  ? visibleArticle.title
                  : articleState === "loading"
                    ? "正在加载章节…"
                    : current.title?.trim() || `第 ${current.position} 章`}
              </h1>
              {/* The lede scales with the body but stays subordinate to it: no
                  size of its own, so it inherits the reader's choice, and a
                  tighter leading than the body so it reads as one block. */}
              {visibleArticle?.summary ? (
                <p className="mt-3 leading-7 text-muted-foreground">{visibleArticle.summary}</p>
              ) : null}

              {articleState === "loading" ? (
                <PageState kind="loading" />
              ) : articleState === "error" ? (
                <div>
                  <PageState
                    kind="empty"
                    title="章节正文暂不可读"
                    description="该文章可能尚未公开，或已经从系列中移除。"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setArticleReloadKey((key) => key + 1)}
                    >
                      重试本章
                    </Button>
                    {currentIndex > 0 ? (
                      <Button variant="outline" onClick={() => selectChapter(0)}>
                        从第一章开始
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <ArticleMarkdownBody body={prepared?.markdown ?? visibleArticle?.body ?? ""} />
                </div>
              )}

              {/*
                Chapter switching closes the reading column instead of sitting
                outside it. It used to span the full article column, so the two
                buttons drifted away from the text's edges the moment the measure
                was set to 窄 — a pair of controls pointing at content that is no
                longer between them.

                `nav` + `aria-label` because a bare "上一篇 / 下一篇" pair
                announces nothing about what is being switched. The visible
                labels stay short; the announced name carries the context.
              */}
              <nav
                aria-label="章节切换"
                className="mt-10 flex items-center justify-between border-t border-border/60 pt-6"
              >
                <Button
                  variant="outline"
                  disabled={currentIndex <= 0}
                  onClick={() => selectChapter(currentIndex - 1)}
                >
                  上一篇
                </Button>
                <Button
                  variant="outline"
                  disabled={currentIndex >= chapters.length - 1}
                  onClick={() => selectChapter(currentIndex + 1)}
                >
                  下一篇
                </Button>
              </nav>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
