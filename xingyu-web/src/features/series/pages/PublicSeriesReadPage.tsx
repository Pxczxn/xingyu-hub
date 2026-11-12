import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import {
  ReaderFrame,
  ReaderProgress,
  ReaderSourceCard,
  readerDocumentStats,
} from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesCover } from "@/components/visual/SeriesCover";
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
import { cn } from "@/lib/cn";
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

/*
 * Body typography overrides (user correction, 2026-11-10): 1.15em between
 * paragraphs, h2 28/600 (48 above, 16 below), a real 3px quote rule and real
 * `<ol>/<ul>` rhythm. These are exactly the values `/articles/:id` applies, and
 * they are stated as descendant variants for the same reason: `.article-body`
 * owns `18px / 1.85` in `globals.css`, which is outside this task's scope. The
 * specificity is `.wrapper .article-body > * + *` (0,2,1) against the globals'
 * `.article-body > * + *` (0,1,1).
 *
 * READER NOTE — `/articles/:id` carries the same class list in
 * `ArticleDetailPage.BODY_TYPOGRAPHY` because a shared constant would have to
 * live outside both pages' write scopes. If it ever moves, it moves to
 * `components/layout/ReaderFrame.tsx` so every content-reading page imports it.
 */
const BODY_TYPOGRAPHY = cn(
  /* Shared default leading for every content-reading page (1.9). This page has
     no line-height control: the value is the template's, not a preference. */
  "[&_.article-body]:leading-[1.9]",
  "[&_.article-body_p]:leading-[1.9]",
  "[&_.article-body>*+*]:mt-[1.15em]",
  "[&_.article-body_h2]:mt-12",
  "[&_.article-body_h2]:mb-4",
  "[&_.article-body_h2]:text-[1.5556em]",
  "[&_.article-body_blockquote]:border-l-[3px]",
  "[&_.article-body_ol]:gap-2",
  "[&_.article-body_ul]:gap-2",
  "[&_.article-body_ol]:pl-[1.5em]",
  "[&_.article-body_ul]:pl-[1.5em]",
);

/**
 * 内容阅读页（系列章节）— `/series/:id/read`.
 *
 * Phase 2G built the continuous reading flow, Phase 3 added chapter deep links
 * and progress, and Phase 4 made it usable on a phone. 2026-11-10 (user
 * correction) removed the last per-content-type layout: this page now renders
 * through the SAME `ReaderFrame` as 文章 / 指南 / 公告 / 规则 — same tracks, same
 * block order (工具 → 目录 → 进度), same paper surface, same typography. The only
 * permitted difference is the cover above the body, and it only exists because
 * the series has one.
 *
 *   <1024   the chapter position + the two sheets (目录 / 设置) live in one
 *           sticky row. The catalogue lives in a left Sheet opened from it;
 *           stacking a 40-chapter list above the text is exactly the problem
 *           Phase 4 removed.
 *   ≥1440   the tools and the chapter catalogue are the right track, the source
 *           card is the left track; 1024–1439 is one centred column, the same
 *           as every other content-reading page (no rails in that band).
 *
 * Typography (font size + measure) is persisted per browser, for guests too.
 * Only those two values are stored; reading history never is. They stay on the
 * series' own [15..24] / 58–80ch ladder: that is a user setting stored by
 * `reader-preferences`, not a second layout.
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
  /* The desktop catalogue track, revealed on the same condition (a 32-chapter
     catalogue must not leave the reader looking at chapters 1–13 while they are
     on 18). */
  const sidebarNavRef = useRef<HTMLDivElement | null>(null);
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

  /* Reveal the selected chapter in the desktop track as well. `nearest` keeps
     it from moving when the chapter is already visible. */
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
   * Crossing into the band where the right track becomes visible makes a
   * catalogue that was `display:none` appear. No chapter or series state
   * changes then, so the effect above would not run and a tablet→desktop
   * resize (or rotation) would leave the current chapter scrolled out of view.
   * Reveal it on that transition too; ordinary re-renders and typography
   * changes still do NOT move the track.
   */
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const rails = window.matchMedia("(min-width: 1440px)");
    const onBreakpointChange = () => {
      if (rails.matches) requestAnimationFrame(revealSidebarChapter);
    };
    rails.addEventListener("change", onBreakpointChange);
    return () => rails.removeEventListener("change", onBreakpointChange);
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
  /* Real numbers from the rendered chapter body — no API field is invented. */
  const stats = readerDocumentStats(prepared?.markdown ?? visibleArticle?.body ?? "");
  const chapterCount = chapters.length;

  /*
   * 内容阅读页（系列章节）· 与 `/articles/:id`、`/guide/:slug`、`/announcements/:id`、
   * `/rules` 完全同一套 `ReaderFrame` 模板（用户 2026-11-10 口径：都是看内容的地方，
   * 公用的，不再有「系列阅读」专属版式）。
   *
   *   栏位   左栏「关于这份内容」= 作者 + 系列 + 章数 + 本章发布日期 + 字数 / 段落；
   *          右栏块序 工具 → 目录 → 进度；正文列 = 纸面卡。
   *   唯一差异  系列有封面，所以正文列上方多一条头图（`SeriesCover` jacket）；
   *          没有该数据的页面（指南 / 规则 / 公告）不放。
   *   标题   eyebrow（第 N 章）→ h1 44/700/1.15 → 摘要 → meta（系列 · 第 n / N 章 ·
   *          日期 · 约 N 字）→ 1px 发丝线 → 48px → 正文。
   *   正文   与文章页同一份排版覆盖（段距 1.15em、h2 28/600、3px 引用竖线、
   *          真 `<ol>/<ul>`）；字号/阅读宽度沿用 series 的持久化偏好（`reader-preferences`），
   *          所以 `reader-column` 仍带内联 fontSize/maxWidth。
   *   移动端 <1024  吸顶一行：返回系列 · 章节位置 · 目录 / 设置（两个 Sheet 的入口）；
   *          ≥1440 目录与设置都在右栏；1024–1439 与其它内容阅读页一样是单列无轨。
   *
   * 行为未变：api、三态、深链 `?chapter=`、切章滚动、上一/下一章、进度上报、
   * `ui/sheet` 的焦点/滚动锁/关闭归位全部原样保留。
   */
  if (!current) {
    return (
      <ReaderFrame>
        <PageState
          kind="empty"
          title="暂无可阅读章节"
          description="该系列发布章节后会显示在这里。"
        />
      </ReaderFrame>
    );
  }

  return (
    <div>
      <ReaderFrame
        asideLeftLabel="关于这份内容"
        asideLeft={
          <ReaderSourceCard
            name={series.author.displayName ?? series.author.username}
            handle={series.author.username}
            avatarUrl={series.author.avatar}
            href={`/u/${series.author.username}`}
            rows={[
              {
                label: "系列",
                value: (
                  <Link
                    to={`/series/${encodeURIComponent(series.id)}`}
                    className="focus-ring rounded-sm transition-colors hover:text-accent-strong"
                  >
                    {series.title}
                  </Link>
                ),
              },
              { label: "章数", value: `${chapterCount} 章` },
              ...(visibleArticle?.publishedAt
                ? [
                    {
                      label: "发布",
                      value: (
                        <time dateTime={visibleArticle.publishedAt}>
                          {formatDate(visibleArticle.publishedAt)}
                        </time>
                      ),
                    },
                  ]
                : []),
              ...(visibleArticle
                ? [
                    { label: "字数", value: `约 ${stats.characters} 字` },
                    { label: "段落", value: `${stats.paragraphs} 段` },
                  ]
                : []),
            ]}
          />
        }
        asideRightLabel="阅读工具与章节目录"
        asideRight={
          <div className="flex flex-col gap-6">
            {/*
              工具块：series 的 A−/A+ 与阅读宽度是持久化用户设置
              （`reader-preferences`，15..24 整数档 / 58–80ch），因此这一块用
              `ReaderSettings` 而不是共享的 16/18/20 + 行距档 —— 档位本身不进版式，
              块的位置和其余内容阅读页一致（工具 → 目录 → 进度）。
            */}
            <ReaderSettings
              stacked
              fontSize={fontSize}
              layout={layout}
              onFontSizeChange={updateFontSize}
              onLayoutChange={updateLayout}
              onReset={resetPreferences}
            />

            {/*
              目录块：与文章目录同一块位（工具之后、进度之前），同一交互
              （当前项高亮 + 点击切换）。系列目录切的是路由状态而不是页内锚点，
              所以用 `ChapterList` 的按钮而不是 `<a href="#…">`。
            */}
            <nav aria-label="章节目录" className="hidden min-w-0 flex-col gap-3 lg:flex">
              <div className="flex items-baseline justify-between gap-3">
                <p className="eyebrow">目录</p>
                <span
                  data-testid="reader-position"
                  className="text-meta tabular-nums text-muted-foreground"
                >
                  {`第 ${currentIndex + 1} / ${chapterCount} 章`}
                </span>
              </div>
              <div ref={sidebarNavRef} className="min-w-0">
                <ChapterList
                  chapters={chapters}
                  currentIndex={currentIndex}
                  currentTitle={visibleArticle?.title}
                  onSelect={selectChapter}
                  dense
                  testId="chapter-nav-sidebar"
                />
              </div>
            </nav>

            <ReaderProgress />
          </div>
        }
      >
        {/*
          <1024：吸顶的章节位置条，同时是两个 Sheet（目录 / 设置）的唯一入口。
          这两行里的 `reader-position-mobile` 与上面右栏的 `reader-position` 是同一
          事实的两种落位（移动端没有右栏）。
        */}
        <div className="sticky top-[var(--shell-header-height)] z-rail -mx-4 mb-2 flex items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 py-2 backdrop-blur md:-mx-6 md:px-6 lg:hidden">
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
            {`第 ${currentIndex + 1} / ${chapterCount} 章`}
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
                Left sheet, not a page section: the text stays where it is, and
                Radix owns Escape, the focus trap, background scroll locking and
                focus return to the trigger.
              */}
              <SheetContent
                side="left"
                className="flex w-[86vw] max-w-sm flex-col gap-0 p-0"
                onCloseAutoFocus={(event) => {
                  /* Keep the reading position: the trigger is in the sticky bar
                     at the top, and a plain focus() would scroll the reader back
                     there. Radix still returns focus to the trigger; this only
                     stops it from moving the page. */
                  event.preventDefault();
                  chapterTriggerRef.current?.focus({ preventScroll: true });
                }}
              >
                <SheetHeader className="border-b border-border/60 px-4 pb-3 pr-14 pt-4 text-left">
                  <SheetTitle className="truncate text-base font-semibold text-primary">
                    {series.title}
                  </SheetTitle>
                  <SheetDescription className="text-meta tabular-nums text-muted-foreground">
                    {`第 ${currentIndex + 1} / ${chapterCount} 章`}
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

        <div className="rounded-card border border-border bg-card p-6 min-[1024px]:px-14 min-[1024px]:py-12">
          <header>
            <div className="flex items-start justify-between gap-4">
              <p className="eyebrow">{`第 ${current.position} 章`}</p>
            </div>
            <h1 className="mt-3 text-[44px] font-bold leading-[1.15] tracking-tight text-primary">
              {/* Prefer the loaded chapter title; fall back to the series
                  contract's title (the API may omit it) or the position. */}
              {visibleArticle?.title
                ? visibleArticle.title
                : articleState === "loading"
                  ? "正在加载章节…"
                  : current.title?.trim() || `第 ${current.position} 章`}
            </h1>
            {/* The lede is the standard 18px sub-head; it does not follow the
                reader's font-size control, same as the article page. */}
            {visibleArticle?.summary ? (
              <p className="mt-5 text-[18px] leading-[1.7] text-foreground-soft">
                {visibleArticle.summary}
              </p>
            ) : null}
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground">
              <span className="min-w-0 truncate font-medium text-foreground-soft">
                {series.title}
              </span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{`第 ${currentIndex + 1} / ${chapterCount} 章`}</span>
              {visibleArticle?.publishedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <time dateTime={visibleArticle.publishedAt} className="tabular-nums">
                    {formatDate(visibleArticle.publishedAt)}
                  </time>
                </>
              ) : null}
              <span aria-hidden>·</span>
              <span className="tabular-nums">约 {stats.characters} 字</span>
            </p>
            {/* 1px 发丝线：宽 = 正文列。 */}
            <div aria-hidden className="mt-6 border-b border-border" />
          </header>

          {chapterNotFound ? (
            <p
              role="status"
              className="mt-6 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-meta text-muted-foreground"
            >
              该章节不存在或已从系列中移除，已从第一章开始。
            </p>
          ) : null}

          {/*
            唯一允许的差异：系列有封面，所以正文列上方多一条头图。
            指南 / 规则 / 公告没有封面数据，因此不放（文章有 `coverUrl` 时同样放一条）。
          */}
          <SeriesCover
            stableKey={`${series.id}:${series.slug}`}
            title={series.title}
            variant="jacket"
            className="mx-auto mt-8 w-32 sm:w-36"
          />

          {/*
            One reading column carrying the reader's own size and measure, so
            `ch` resolves against the reader's font-size. `reader-column` is what
            lets `.article-body` inherit that size instead of its own 15px default.
          */}
          <div
            data-testid="reader-column"
            className={cn("reader-column mx-auto mt-12", BODY_TYPOGRAPHY)}
            style={{ fontSize, maxWidth: measure }}
          >
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
              <ArticleMarkdownBody body={prepared?.markdown ?? visibleArticle?.body ?? ""} />
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
                disabled={currentIndex >= chapterCount - 1}
                onClick={() => selectChapter(currentIndex + 1)}
              >
                下一篇
              </Button>
            </nav>

            {/*
              The reader deliberately carries no interaction controls, but a
              reader who finishes a chapter and wants to react used to have no
              exit at all. One quiet secondary line, not an embedded widget:
              mounting the interaction bar here would fetch likes and comments
              for every chapter and turn a reading surface into another feed.
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
        </div>
      </ReaderFrame>
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}
