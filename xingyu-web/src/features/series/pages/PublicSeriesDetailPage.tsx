import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesDetail } from "@/api/series/series.types";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth.store";
import { cn } from "@/lib/cn";

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
 * Public series detail (Phase 2G + Series Subscription Closure, 2026-10-10).
 *
 * Backend: GET /api/v1/series/{id} -> SeriesDetail, 404 for a missing or
 * non-ACTIVE series. Chapters come back ordered by `position`; each links to
 * the underlying article.
 *
 * Subscription: the payload now carries viewer-scoped `hasSubscribed`
 * (true/false for signed-in viewers, null for guests), so the control starts
 * in the right state after a refresh — no parallel bookshelf probing. Toggle
 * uses the same optimistic/guard/rollback discipline as the interaction bar;
 * the backend unsubscribe is idempotent and (unlike subscribe) has no ACTIVE
 * status gate, so existing subscribers can always cancel.
 */
export function PublicSeriesDetailPage() {
  const { seriesId = "" } = useParams<{ seriesId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [subscribePending, setSubscribePending] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

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
  }, [seriesId]);

  async function onToggleSubscribe() {
    if (subscribePending || subscribed === null) return; // duplicate-click guard
    setSubscribeError(null);
    const next = !subscribed;
    // Optimistic update, rolled back if the request fails.
    setSubscribed(next);
    setSubscribePending(true);
    try {
      if (next) await seriesApi.subscribe(seriesId);
      else await seriesApi.unsubscribe(seriesId);
    } catch {
      setSubscribed(!next);
      setSubscribeError(next ? "订阅失败，请重试。" : "取消订阅失败，请重试。");
    } finally {
      setSubscribePending(false);
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
        <h1 className="text-2xl font-semibold text-primary">{series.title}</h1>
        <Link
          to={`/u/${encodeURIComponent(series.author.username)}`}
          className="mt-2 inline-flex text-sm font-medium text-accent hover:underline"
        >
          {series.author.displayName?.trim() || `@${series.author.username}`}
        </Link>
        {series.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{series.description}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">该系列暂未提供简介。</p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{`${chapters.length} 章`}</p>

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
          ) : subscribed !== null ? (
            <Button
              type="button"
              variant={subscribed ? "secondary" : "outline"}
              size="sm"
              disabled={subscribePending}
              aria-pressed={subscribed}
              onClick={() => void onToggleSubscribe()}
            >
              {subscribed ? "已订阅" : "订阅系列"}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">订阅状态不可用</span>
          )}
          {subscribeError ? (
            <span role="alert" className="text-sm text-destructive">
              {subscribeError}
            </span>
          ) : null}
        </div>
      </header>

      <PageSection id="series-chapters" title="章节目录" count={chapters.length}>
        {chapters.length === 0 ? (
          <PageState kind="empty" title="暂无章节" description="章节发布后会显示在这里。" />
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border/70 bg-card">
            {chapters.map((chapter, index) => (
              <li key={chapter.id} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Link
                  to={`/articles/${encodeURIComponent(chapter.articleId)}`}
                  className={cn("text-sm font-medium hover:text-accent")}
                >
                  {/* Prefer the API title and retain a positional fallback for
                      legacy or unavailable search documents. */}
                  {chapter.title?.trim() || `第 ${chapter.position} 章`}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </PageSection>
    </article>
  );
}
