import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";
import { formatUpdatedAt, seriesStatusLabel } from "../series-labels";

type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error" }
  | { kind: "ready"; series: PublicSeriesDetail };

type SubscribeState = "idle" | "pending" | "done" | "error";

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && (err.problem.status === 404 || err.problem.code === "NOT_FOUND");
}

/**
 * Public series detail (Phase 2G).
 *
 * Backend: GET /api/v1/series/{id} -> SeriesDetail, 404 for a missing or
 * non-ACTIVE series. Chapters come back ordered by `position`; each links to
 * the underlying article.
 */
export function PublicSeriesDetailPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [subscribeState, setSubscribeState] = useState<SubscribeState>("idle");

  useEffect(() => {
    if (!seriesId) {
      setState({ kind: "unavailable" });
      return;
    }
    let active = true;
    setState({ kind: "loading" });
    setSubscribeState("idle");
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

  async function onSubscribe() {
    setSubscribeState("pending");
    try {
      await seriesApi.subscribe(seriesId);
      setSubscribeState("done");
    } catch {
      setSubscribeState("error");
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") return <PageState kind="error" />;
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="系列不存在或尚未公开" />;
  }

  const { series } = state;
  const chapters = [...(series.chapters ?? [])].sort((a, b) => a.position - b.position);

  return (
    <article className="section-gap">
      <nav className="text-sm text-muted-foreground">
        <Link to="/series" className="hover:text-accent">
          系列广场
        </Link>
        <span className="mx-2">/</span>
        <span>{series.title}</span>
      </nav>

      <header className="rounded-lg border border-border bg-card p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {seriesStatusLabel(series.status)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-primary">{series.title}</h1>
        {series.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{series.description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">该系列暂未提供简介。</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {`${chapters.length} 章 · ${formatUpdatedAt(series.updatedAt)} 更新`}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {chapters.length > 0 ? (
            <Link
              to={`/series/${encodeURIComponent(series.id)}/read`}
              className="text-sm font-medium text-accent hover:underline"
            >
              开始阅读
            </Link>
          ) : null}

          {!isAuthenticated ? (
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/series/${series.id}`)}`}
              className="text-sm text-accent hover:underline"
            >
              登录后订阅
            </Link>
          ) : subscribeState === "done" ? (
            <span className="text-sm text-muted-foreground">已订阅</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={subscribeState === "pending"}
              onClick={() => void onSubscribe()}
            >
              订阅系列
            </Button>
          )}
          {subscribeState === "error" ? (
            <span role="alert" className="text-sm text-destructive">
              订阅失败，请重试。
            </span>
          ) : null}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-primary">章节目录</h2>
        {chapters.length === 0 ? (
          <PageState kind="empty" title="暂无章节" description="章节发布后会显示在这里。" />
        ) : (
          <ol className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {chapters.map((chapter, index) => (
              <li key={chapter.id} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link
                  to={`/articles/${encodeURIComponent(chapter.articleId)}`}
                  className={cn("text-sm font-medium hover:text-accent")}
                >
                  {/* The backend never populates chapter.title (it has no join to
                      the article), so fall back to a positional label rather
                      than printing "无标题文章" for every row. */}
                  {chapter.title?.trim() || `第 ${chapter.position} 章`}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
