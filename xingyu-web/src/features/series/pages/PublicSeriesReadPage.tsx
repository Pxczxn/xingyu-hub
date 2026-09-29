import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

const LAYOUTS = [
  ["narrow", "窄", 680],
  ["medium", "适中", 820],
  ["wide", "宽", 960],
] as const;

type LayoutKey = (typeof LAYOUTS)[number][0];

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND");
}

/**
 * Series reader (Phase 2G).
 *
 * Loads the public series, sorts chapters by `position`, and renders the
 * selected chapter's article through the migrated Legacy reading pipeline
 * (ArticleMarkdownBody + prepareArticleBodyForRead) — the same renderer the
 * article detail page uses, so a chapter reads identically to the article.
 *
 * Reading progress is reported to POST /api/v1/me/reading-progress for signed-in
 * users; the backend decides what to persist, so a failure here is swallowed.
 */
export function PublicSeriesReadPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [layout, setLayout] = useState<LayoutKey>("medium");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [articleState, setArticleState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!seriesId) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    setCurrentIndex(0);
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
  }, [seriesId]);

  const chapters =
    state.kind === "ready" ? [...(state.series.chapters ?? [])].sort((a, b) => a.position - b.position) : [];
  const current = chapters[currentIndex] ?? chapters[0];

  useEffect(() => {
    if (!current) {
      setArticle(null);
      setArticleState("idle");
      return;
    }
    let active = true;
    setArticleState("loading");
    articlesApi
      .getArticle(current.articleId)
      .then((data) => {
        if (!active) return;
        setArticle(data);
        setArticleState("idle");
      })
      .catch(() => {
        if (!active) return;
        setArticleState("error");
      });
    return () => {
      active = false;
    };
  }, [current?.articleId]);

  async function openChapter(index: number) {
    const chapter = chapters[index];
    if (!chapter) return;
    setCurrentIndex(index);
    if (!isAuthenticated) return;
    try {
      await seriesApi.recordReadingProgress(seriesId, chapter.articleId);
    } catch {
      /* Progress is best-effort; the backend owns the persisted state. */
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") return <PageState kind="error" />;
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="系列不存在或无权访问" />;
  }

  const { series } = state;
  const prepared = article ? prepareArticleBodyForRead(article.body) : null;
  const width = LAYOUTS.find(([key]) => key === layout)?.[2] ?? 820;

  return (
    <div className="section-gap lg:flex lg:gap-6">
      <aside className="lg:w-64 lg:shrink-0">
        <Link to={`/series/${encodeURIComponent(series.id)}`} className="text-sm text-muted-foreground hover:text-accent">
          ← 返回系列
        </Link>
        <h2 className="mt-2 text-base font-semibold text-primary">{series.title}</h2>
        <p className="text-xs text-muted-foreground">{`${chapters.length} 章`}</p>
        <ol className="mt-3 flex flex-col gap-1">
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => void openChapter(index)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  index === currentIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="mr-2 tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                {/* chapter.title is always null on the backend; use the article
                    title once loaded, else a positional label. */}
                {index === currentIndex && article?.title
                  ? article.title
                  : chapter.title?.trim() || `第 ${chapter.position} 章`}
              </button>
            </li>
          ))}
        </ol>
      </aside>

      <article className="min-w-0 flex-1">
        {!current ? (
          <PageState kind="empty" title="暂无可阅读章节" description="该系列发布章节后会显示在这里。" />
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{`第 ${currentIndex + 1} / ${chapters.length} 章`}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="减小字号"
                  className="rounded border border-border px-2 py-0.5"
                  onClick={() => setFontSize((value) => Math.max(15, value - 1))}
                >
                  A-
                </button>
                <span>{fontSize}</span>
                <button
                  type="button"
                  aria-label="增大字号"
                  className="rounded border border-border px-2 py-0.5"
                  onClick={() => setFontSize((value) => Math.min(24, value + 1))}
                >
                  A+
                </button>
                {LAYOUTS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "rounded border px-2 py-0.5",
                      layout === key ? "border-accent text-accent" : "border-border",
                    )}
                    onClick={() => setLayout(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mx-auto mt-4" style={{ fontSize, maxWidth: width }}>
              <h1 className="text-2xl font-semibold text-primary">
                {/* The series chapter carries its own `title`, but the backend
                    returns null when the chapter was created without one. While
                    the article is still loading we avoid the misleading
                    "无标题文章" fallback and show a neutral placeholder instead. */}
                {article?.title
                  ? article.title
                  : articleState === "loading"
                    ? "正在加载章节…"
                    : current.title?.trim() || `第 ${current.position} 章`}
              </h1>
              {article?.summary ? (
                <p className="mt-2 text-sm text-muted-foreground">{article.summary}</p>
              ) : null}

              {articleState === "loading" ? (
                <PageState kind="loading" />
              ) : articleState === "error" ? (
                <PageState kind="empty" title="章节正文暂不可读" description="该文章可能尚未公开。" />
              ) : (
                <div className="mt-4">
                  <ArticleMarkdownBody body={prepared?.markdown ?? article?.body ?? ""} />
                </div>
              )}
            </div>

            <footer className="mt-8 flex justify-between">
              <Button
                variant="outline"
                disabled={currentIndex <= 0}
                onClick={() => void openChapter(currentIndex - 1)}
              >
                上一篇
              </Button>
              <Button
                variant="outline"
                disabled={currentIndex >= chapters.length - 1}
                onClick={() => void openChapter(currentIndex + 1)}
              >
                下一篇
              </Button>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}

