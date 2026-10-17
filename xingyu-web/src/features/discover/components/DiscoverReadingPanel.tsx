import { useEffect, useId, useMemo, useRef, useState } from "react";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { ArticleMarkdownBody, extractArticleOutline } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";

interface DiscoverReadingPanelProps {
  content: ArticleDetail | PublicSeriesDetail;
}

type ChapterState =
  | { id: string; kind: "loading" | "error" }
  | { id: string; kind: "ready"; article: ArticleDetail };

export function DiscoverReadingPanel({ content }: DiscoverReadingPanelProps) {
  const headingPrefix = `${useId()}-heading-`;
  const directoryId = useId();
  const readingViewport = useRef<HTMLDivElement>(null);
  const chapters = "chapters" in content ? content.chapters : null;
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterState, setChapterState] = useState<ChapterState | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [outlineExpanded, setOutlineExpanded] = useState(false);
  const chapterId = chapters?.find((chapter) => chapter.articleId === selectedChapter)?.articleId
    ?? chapters?.[0]?.articleId;

  useEffect(() => {
    if (!chapterId) return;
    if (readingViewport.current) readingViewport.current.scrollTop = 0;
    let active = true;
    setChapterState({ id: chapterId, kind: "loading" });
    articlesApi.getArticle(chapterId).then((article) => {
      if (active) setChapterState({ id: chapterId, kind: "ready", article });
    }).catch(() => {
      if (active) setChapterState({ id: chapterId, kind: "error" });
    });
    return () => { active = false; };
  }, [chapterId, retryKey]);

  const article = "body" in content ? content
    : chapterState?.id === chapterId && chapterState?.kind === "ready" ? chapterState.article : null;
  const prepared = useMemo(() => article ? prepareArticleBodyForRead(article.body) : null, [article]);
  const outline = useMemo(() => prepared ? extractArticleOutline(prepared.markdown, headingPrefix) : [], [prepared, headingPrefix]);
  const chapterError = chapterState?.id === chapterId && chapterState?.kind === "error";
  const visibleOutline = outlineExpanded ? outline : outline.slice(0, 6);

  const locateHeading = (id: string) => {
    const viewport = readingViewport.current;
    const heading = document.getElementById(id);
    if (!viewport || !heading || !viewport.contains(heading)) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    const inset = parseFloat(getComputedStyle(viewport).paddingTop) || 16;
    if (window.matchMedia("(max-width: 1023px)").matches) {
      // On narrow screens the document owns scrolling; the body has no scroll box.
      const header = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
      const toolbar = viewport.closest("[data-discover-variant]")?.querySelector<HTMLElement>("[data-reading-toolbar]");
      const toolbarBottom = toolbar
        ? (parseFloat(getComputedStyle(toolbar).top) || header) + toolbar.getBoundingClientRect().height
        : 0;
      window.scrollTo({ top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - Math.max(header, toolbarBottom) - inset), behavior });
    } else {
      viewport.scrollTo({ top: Math.max(0, viewport.scrollTop + heading.getBoundingClientRect().top - viewport.getBoundingClientRect().top - inset), behavior });
    }
  };

  return (
    <div className="discover-reader min-w-0">
      <nav aria-label={chapters ? "章节目录" : "文章目录"} className="discover-directory min-w-0 rounded-lg border border-border/60 bg-background/80 px-2 lg:p-2">
        <button type="button" aria-expanded={directoryOpen} aria-controls={directoryId}
          onClick={() => setDirectoryOpen((open) => !open)}
          className="focus-ring min-h-11 w-full rounded-md px-2 text-left text-sm text-accent-strong lg:hidden">
          {directoryOpen ? "收起目录" : chapters ? "章节与文章目录" : "展开文章目录"}
        </button>
        <div id={directoryId} className="discover-directory-content space-y-3" data-open={directoryOpen}>
          {chapters && (chapters.length ? (
            <label className="block text-xs font-medium text-muted-foreground">
              切换章节
              <select value={chapterId} onChange={(event) => {
                setSelectedChapter(event.target.value);
                setOutlineExpanded(false);
              }} className="focus-ring mt-2 min-h-11 w-full min-w-0 rounded-md border border-border bg-card px-2 text-sm text-foreground">
                {chapters.map((chapter, index) => <option key={chapter.articleId} value={chapter.articleId}>
                  {index + 1}. {chapter.title || `第 ${index + 1} 章`}
                </option>)}
              </select>
            </label>
          ) : <p className="text-xs text-muted-foreground">暂无章节</p>)}
          {outline.length ? <>
            <ul className="space-y-1">
              {visibleOutline.map((heading) => <li key={heading.id}>
                <a href={`#${heading.id}`} onClick={(event) => { event.preventDefault(); locateHeading(heading.id); }}
                  className="focus-ring block min-h-11 break-words rounded-md px-2 py-2 text-xs leading-5 text-muted-foreground hover:bg-muted/50 hover:text-accent-strong">
                  {heading.text}
                </a>
              </li>)}
            </ul>
            {outline.length > 6 && <button type="button" aria-expanded={outlineExpanded}
              onClick={() => setOutlineExpanded((open) => !open)} className="focus-ring min-h-11 rounded px-2 text-xs text-accent-strong">
              {outlineExpanded ? "收起小节" : `显示全部 ${outline.length} 个小节`}
            </button>}
          </> : <p className="px-2 text-xs text-muted-foreground">暂无小节标题</p>}
        </div>
      </nav>
      <section aria-label="正文预览" className="min-w-0 rounded-lg border border-border/60 bg-card">
        {/* A native scroll viewport needs a tab stop so keyboard readers can scroll its full body. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard access to the native scroll region. */}
        <div ref={readingViewport} data-reading-viewport role="region" tabIndex={0} aria-label="阅读正文"
          className="discover-reading-viewport focus-ring break-words rounded-lg p-3"
          aria-busy={Boolean(chapterId && !article && !chapterError)}>
          {article && prepared ? (
            <ArticleMarkdownBody body={prepared.markdown} headingIdPrefix={headingPrefix} />
          ) : chapterError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">章节加载失败，请重试。</p>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="focus-ring min-h-11 rounded px-2 text-sm text-accent-strong">重新加载章节</button>
            </div>
          ) : chapterId ? (
            <p role="status" className="text-sm text-muted-foreground">章节加载中...</p>
          ) : <p className="text-sm text-muted-foreground">暂无可阅读章节</p>}
        </div>
      </section>
    </div>
  );
}
