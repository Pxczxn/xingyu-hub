import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArticleMarkdownBody } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { useAuth } from "@/features/auth/auth.store";
import { ChapterList } from "../components/ChapterList";
import { ReaderSettings } from "../components/ReaderSettings";
import {
  READER_DEFAULT_PREFERENCES,
  READER_LAYOUTS,
  loadReaderPreferences,
  saveReaderPreferences,
  type ReaderLayout,
  type ReaderPreferences,
} from "../reader-preferences";
import { useSeriesProgressWriter } from "../useSeriesProgressWriter";

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

/**
 * Series reader.
 *
 * Phase 2G built the continuous reader, Phase 3 added chapter deep links and
 * progress, and Phase 4 makes the same reader comfortable on a phone:
 *
 *   - Desktop keeps the sticky chapter rail; the article gets its own column.
 *   - Below `lg`, the rail is NOT stacked above the article any more (on a
 *     40-chapter series that meant scrolling past the whole catalogue before
 *     reaching the text). The text comes first, and the catalogue lives in a
 *     left Sheet opened from the reading toolbar.
 *   - Typography (font size + measure) is persisted per browser, for guests
 *     too. Only those two values are stored; reading history never is.
 *
 * The selected chapter stays URL state (`?chapter=<articleId>`): refresh,
 * sharing and back/forward all resolve to the same chapter. An unknown id
 * degrades to the first chapter with a notice and can never select an article
 * that is not a chapter of this series.
 *
 * Reading progress is written to POST /api/v1/me/reading-progress once a
 * chapter has actually loaded, through `useSeriesProgressWriter`, which keeps
 * one request in flight so a delayed earlier chapter cannot land after a later
 * one. The backend owns visibility, the history toggle and validation.
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
  /* Lazy initializer: the stored typography is applied on the FIRST render, so
     a returning reader does not see a frame at 18px before it snaps to 24px. */
  const [preferences, setPreferences] = useState<ReaderPreferences>(loadReaderPreferences);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [articleState, setArticleState] = useState<"idle" | "loading" | "error">("idle");
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* Bumping either key replays its load effect — the retry mechanism for the
     two error branches below. Both effects keep their per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);
  const [articleReloadKey, setArticleReloadKey] = useState(0);
  /* Progress writes are serialized per reader page: see the hook for the exact
     guarantee and the cross-tab boundary. */
  const recordProgress = useSeriesProgressWriter(isAuthenticated);
  /* Previous chapter key, used to scroll to the top ONLY on a real switch. */
  const previousChapterRef = useRef<string | null>(null);
  /* The drawer's scroll container, used to reveal the current chapter. */
  const chapterNavRef = useRef<HTMLElement | null>(null);
  /* The desktop rail, revealed on the same condition (a 32-chapter rail must
     not leave the reader looking at chapters 1–13 while they are on 18). */
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  /* Focus returns here after the drawer closes (including after a chapter is
     picked, where Radix cannot restore focus because the pick also navigates). */
  const chapterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);

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
    state.kind === "ready" &&
    chapters.length > 0 &&
    requestedArticleId !== null &&
    requestedIndex < 0;
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
   * is pressed. That covers every entry path (first chapter, deep link, rail,
   * drawer, previous/next) with one rule, and it never records an article the
   * reader could not read.
   *
   * The write goes through `useSeriesProgressWriter`, which keeps at most one
   * request in flight, so a delayed earlier chapter cannot land after a later
   * one. Failures are retried once and never interrupt reading; repeated
   * renders of the same loaded chapter are deduped. Opening the chapter drawer
   * does not write anything by itself.
   */
  useEffect(() => {
    if (!isAuthenticated || articleState !== "idle" || !article || !currentArticleId) return;
    if (article.id !== currentArticleId) return;
    recordProgress(seriesId, article.id);
  }, [article, articleState, currentArticleId, isAuthenticated, recordProgress, seriesId]);

  /* Persist only the two typography values. A storage failure is silent; the
     in-memory setting still applies for this visit. */
  useEffect(() => {
    saveReaderPreferences(preferences);
  }, [preferences]);

  /* Reveal the current chapter when the drawer opens (and if it changes while
     open). Without this a 40-chapter series always starts at chapter 1 and the
     reader has to hunt for where they are. */
  useEffect(() => {
    if (!chapterDrawerOpen) return;
    const frame = requestAnimationFrame(() => {
      chapterNavRef.current
        ?.querySelector<HTMLElement>('[aria-current="true"]')
        ?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterDrawerOpen, currentIndex]);

  /* Reveal the selected chapter in the desktop rail as well. `nearest` keeps it
     from moving when the chapter is already visible. */
  const revealSidebarChapter = useCallback(() => {
    sidebarNavRef.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, []);

  useEffect(() => {
    if (state.kind !== "ready") return;
    const frame = requestAnimationFrame(revealSidebarChapter);
    return () => cancelAnimationFrame(frame);
  }, [state.kind, currentIndex, revealSidebarChapter]);

  /*
   * Crossing into the desktop breakpoint makes a rail that was `display:none`
   * visible. No chapter or series state changes then, so the effect above would
   * not run and a tablet→desktop resize (or rotation) would leave the current
   * chapter scrolled out of view. Reveal it on that transition too; ordinary
   * re-renders and typography changes still do NOT move the rail.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpointChange = () => {
      if (desktop.matches) requestAnimationFrame(revealSidebarChapter);
    };
    desktop.addEventListener("change", onBreakpointChange);
    return () => desktop.removeEventListener("change", onBreakpointChange);
  }, [revealSidebarChapter]);

  function selectChapter(index: number) {
    const chapter = chapters[index];
    if (!chapter || index === currentIndex) return;
    setSearchParams({ chapter: chapter.articleId });
  }

  function selectFromDrawer(index: number) {
    setChapterDrawerOpen(false);
    selectChapter(index);
  }

  function updateFontSize(fontSize: number) {
    setPreferences((previous) => ({ ...previous, fontSize }));
  }

  function updateLayout(layout: ReaderLayout) {
    setPreferences((previous) => ({ ...previous, layout }));
  }

  function resetPreferences() {
    setPreferences({ ...READER_DEFAULT_PREFERENCES });
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
  const fontSize = preferences.fontSize;
  const layout = preferences.layout;
  /*
   * The article that is allowed on screen right now. A loaded article only
   * counts when it belongs to the selected chapter — the request for the
   * previous chapter can resolve after the reader has already moved on.
   */
  const visibleArticle = article && current && article.id === current.articleId ? article : null;
  const prepared = visibleArticle ? prepareArticleBodyForRead(visibleArticle.body) : null;
  const measure = READER_LAYOUTS.find(({ key }) => key === layout)?.measure ?? "68ch";

  return (
    <div className="lg:flex lg:gap-6">
      {/*
        Desktop chapter rail. It travels with the reader: by the time someone is
        3000px into chapter 4, the only control that can take them to chapter 5
        must not be 3000px away.

        `lg:self-start` is load-bearing: a flex row stretches its items to the
        tallest one by default, so a full-height `<aside>` has zero travel left
        inside its own box and `sticky` silently does nothing. The inner scroll
        is the other half — a 40-chapter list is taller than the viewport, and a
        sticky box taller than the viewport cannot stick.

        Below `lg` this rail is not rendered at all. Stacking the full catalogue
        above the article is exactly the mobile problem Phase 4 removes; the
        drawer in the reading toolbar takes its place.
      */}
      <aside className="hidden lg:sticky lg:top-24 lg:z-20 lg:block lg:max-h-[calc(100vh-7rem)] lg:w-64 lg:shrink-0 lg:self-start lg:overflow-y-auto lg:[scroll-padding-block:0.75rem]">
        <Link
          to={`/series/${encodeURIComponent(series.id)}`}
          className="focus-ring inline-flex items-center gap-1 rounded-sm text-meta text-muted-foreground transition-colors hover:text-accent-strong"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          返回系列
        </Link>
        <h2 className="mt-3 text-base font-semibold text-primary">{series.title}</h2>
        <p className="text-meta tabular-nums text-muted-foreground">{`${chapters.length} 章`}</p>

        <nav ref={sidebarNavRef} aria-label="章节目录" className="mt-3">
          <ChapterList
            chapters={chapters}
            currentIndex={currentIndex}
            currentTitle={visibleArticle?.title}
            onSelect={selectChapter}
            dense
            testId="chapter-nav-sidebar"
          />
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
            {/*
              Mobile reading toolbar: go back, where am I, catalogue, settings.
              It deliberately does not carry A-/A+/三个宽度 — those live in the
              settings sheet, which keeps this row usable at 375px.
            */}
            <div className="sticky top-[var(--shell-header-height)] z-20 -mx-4 mb-2 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-0.5 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
              <Link
                to={`/series/${encodeURIComponent(series.id)}`}
                className="focus-ring inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-1 text-meta text-muted-foreground transition-colors hover:text-accent-strong"
              >
                <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
                返回系列
              </Link>
              <span
                data-testid="reader-position-mobile"
                className="shrink-0 text-meta tabular-nums text-muted-foreground"
              >
                {`第 ${currentIndex + 1} / ${chapters.length} 章`}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Sheet open={chapterDrawerOpen} onOpenChange={setChapterDrawerOpen}>
                  <SheetTrigger asChild>
                    <button
                      ref={chapterTriggerRef}
                      type="button"
                      className="focus-ring inline-flex h-11 items-center rounded-md border border-border/70 px-2.5 text-meta font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      目录
                    </button>
                  </SheetTrigger>
                  {/*
                    Left sheet, not a page section: the text stays where it is,
                    and Radix owns Escape, the focus trap, background scroll
                    locking and focus return to the trigger.
                  */}
                  <SheetContent
                    side="left"
                    className="flex w-[86vw] max-w-sm flex-col gap-0 p-0"
                    onCloseAutoFocus={(event) => {
                      /* Keep the reading position: the trigger is in the toolbar
                         at the top, and a plain focus() would scroll the reader
                         back there. Radix still returns focus to the trigger;
                         this only stops it from moving the page. */
                      event.preventDefault();
                      chapterTriggerRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <SheetHeader className="border-b border-border/60 px-4 pb-3 pr-14 pt-4 text-left">
                      <SheetTitle className="truncate text-base font-semibold text-primary">
                        {series.title}
                      </SheetTitle>
                      <SheetDescription className="text-meta tabular-nums text-muted-foreground">
                        {`第 ${currentIndex + 1} / ${chapters.length} 章`}
                      </SheetDescription>
                    </SheetHeader>
                    <nav
                      ref={chapterNavRef}
                      aria-label="章节目录"
                      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-[env(safe-area-inset-bottom)]"
                    >
                      <ChapterList
                        chapters={chapters}
                        currentIndex={currentIndex}
                        currentTitle={visibleArticle?.title}
                        onSelect={selectFromDrawer}
                        testId="chapter-nav-drawer"
                      />
                    </nav>
                  </SheetContent>
                </Sheet>

                <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <SheetTrigger asChild>
                    <button
                      ref={settingsTriggerRef}
                      type="button"
                      aria-label="阅读设置"
                      className="focus-ring inline-flex h-11 items-center rounded-md border border-border/70 px-2.5 text-meta font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      设置
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
                    onCloseAutoFocus={(event) => {
                      event.preventDefault();
                      settingsTriggerRef.current?.focus({ preventScroll: true });
                    }}
                  >
                    <SheetHeader className="border-b border-border/60 px-4 pb-3 pr-14 pt-4 text-left">
                      <SheetTitle className="text-base font-semibold text-primary">
                        阅读设置
                      </SheetTitle>
                      <SheetDescription className="text-meta text-muted-foreground">
                        仅保存在当前浏览器，不会记录你读过什么。
                      </SheetDescription>
                    </SheetHeader>
                    <div className="px-4 py-5">
                      <ReaderSettings
                        stacked
                        fontSize={fontSize}
                        layout={layout}
                        onFontSizeChange={updateFontSize}
                        onLayoutChange={updateLayout}
                        onReset={resetPreferences}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {chapterNotFound ? (
              <p
                role="status"
                className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-meta text-muted-foreground lg:mt-0 lg:mb-4"
              >
                该章节不存在或已从系列中移除，已从第一章开始。
              </p>
            ) : null}

            {/*
              Desktop toolbar: where am I + series context on the left, the
              typography controls on the right. Density is reduced by keeping
              the readout (chapter counter, px value) at the same weight as the
              labels and the controls in one quiet strip.
            */}
            <div className="hidden flex-wrap items-center justify-between gap-x-4 gap-y-2 text-meta text-muted-foreground lg:flex">
              <div className="flex min-w-0 items-baseline gap-2">
                <span data-testid="reader-position" className="shrink-0 tabular-nums">
                  {`第 ${currentIndex + 1} / ${chapters.length} 章`}
                </span>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <span className="max-w-[12ch] truncate xl:max-w-[24ch]">{series.title}</span>
              </div>

              <ReaderSettings
                fontSize={fontSize}
                layout={layout}
                onFontSizeChange={updateFontSize}
                onLayoutChange={updateLayout}
                onReset={resetPreferences}
              />
            </div>

            {/*
              One reading column, left-aligned like the article page.

              1. `reader-column` hands the reader's chosen size to the body's
                 type scale. `.article-body` carries a 15px default for every
                 other caller; inside this class it inherits instead.
              2. The inline `fontSize` is what makes `ch` mean anything: `ch`
                 resolves against the element's OWN font-size, so a maxWidth of
                 68ch only holds ~constant glyphs per line while it sits on the
                 element that carries the reader's size.
            */}
            <div
              data-testid="reader-column"
              className="reader-column mt-6"
              style={{ fontSize, maxWidth: measure }}
            >
              <h1 className="text-[1.5em] font-semibold leading-[1.3] tracking-tight text-primary">
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
                <p className="mt-3 leading-[1.6] text-muted-foreground">{visibleArticle.summary}</p>
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
                    <Button variant="outline" onClick={() => setArticleReloadKey((key) => key + 1)}>
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
                outside it, so the two buttons stay on the text's edges at every
                measure. `nav` + `aria-label` gives the pair context: a bare
                "上一篇 / 下一篇" announces nothing about what is being switched.
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

              {/*
                The reader is the one surface that deliberately carries no
                interaction controls, but a reader who finishes a chapter and
                wants to react used to have no exit at all — the page offered
                「上一篇 / 下一篇」and then the footer, and zero links to the
                article page where like / bookmark / comments live. One quiet
                secondary line, not an embedded widget: mounting the interaction
                bar here would fetch likes and comments for every chapter and
                turn a reading surface into another feed.
              */}
              <p className="mt-6 text-sm text-muted-foreground">
                想留下反馈？
                <Link
                  to={`/articles/${current.articleId}`}
                  className="ml-1 font-medium text-accent-strong hover:underline"
                >
                  到文章页点赞、收藏或评论
                </Link>
              </p>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
