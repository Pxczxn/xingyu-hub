import { useEffect, useId, useMemo, useRef, useState } from "react";
import { articlesApi } from "@/api/articles/articles.api";
import type { ArticleDetail } from "@/api/articles/articles.types";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { ArticleMarkdownBody, extractArticleOutline } from "@/lib/article-markdown";
import { prepareArticleBodyForRead } from "@/lib/article-body-read";
import { cn } from "@/lib/cn";

interface DiscoverReadingPanelProps {
  content: ArticleDetail | PublicSeriesDetail;
}

type ChapterState =
  | { id: string; kind: "loading" | "error" }
  | { id: string; kind: "ready"; article: ArticleDetail };

export function DiscoverReadingPanel({ content }: DiscoverReadingPanelProps) {
  const headingPrefix = `${useId()}-heading-`;
  const readingViewport = useRef<HTMLDivElement>(null);
  const chapters = "chapters" in content ? content.chapters : null;
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [chapterState, setChapterState] = useState<ChapterState | null>(null);
  const [retryKey, setRetryKey] = useState(0);
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 md:flex-row">
      <section
        aria-label="正文预览"
        className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border/40 bg-card p-3 sm:p-4 md:flex-[4]"
      >
        {/* 章节加载与正文共用同一个滚动视口，切换章节时只替换其中的内容。 */}
        <div
          ref={readingViewport}
          className="min-h-0 flex-1 scrollbar-none overflow-y-auto break-words"
          aria-busy={Boolean(chapterId && !article && !chapterError)}
        >
          {article && prepared ? (
            <ArticleMarkdownBody body={prepared.markdown} headingIdPrefix={headingPrefix} />
          ) : chapterError ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">章节加载失败，请重试。</p>
              <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="focus-ring rounded text-sm text-accent-strong">重新加载章节</button>
            </div>
          ) : chapterId ? (
            <p role="status" className="text-sm text-muted-foreground">章节加载中...</p>
          ) : (
            <p className="text-sm text-muted-foreground">暂无可阅读章节</p>
          )}
        </div>
      </section>
      <nav
        aria-label={chapters ? "章节目录" : "文章目录"}
        className="flex max-h-40 min-h-0 min-w-0 flex-col md:max-h-none md:flex-[1]"
      >
        {chapters ? (
          chapters.length > 0 ? <ol className="min-h-0 flex-1 scrollbar-none space-y-1 overflow-y-auto">
            {chapters.map((chapter, index) => (
              <li key={chapter.articleId}>
                <button
                  type="button"
                  aria-current={chapterId === chapter.articleId ? "true" : undefined}
                  onClick={() => setSelectedChapter(chapter.articleId)}
                  className={cn("focus-ring block min-h-11 w-full break-words rounded-md px-2 py-2 text-left text-xs leading-5 transition-colors",
                    chapterId === chapter.articleId ? "bg-accent/10 font-medium text-accent-strong" : "text-muted-foreground hover:bg-muted/50")}
                >
                  <span className="mr-1 tabular-nums" aria-hidden>{index + 1}.</span>
                  {chapter.title || `第 ${index + 1} 章`}
                </button>
              </li>
            ))}
          </ol> : <p className="text-xs text-muted-foreground">暂无章节</p>
        ) : outline.length > 0 ? (
          <ul className="min-h-0 flex-1 scrollbar-none space-y-1 overflow-y-auto">
            {outline.map((heading) => (
              <li key={heading.id}>
                <a href={`#${heading.id}`} onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }} className="focus-ring block break-words rounded-md px-1 py-2 text-xs leading-5 text-muted-foreground hover:bg-muted/50 hover:text-accent-strong">
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">暂无小节标题</p>}
      </nav>
    </div>
  );
}
