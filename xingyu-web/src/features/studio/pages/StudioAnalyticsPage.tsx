import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { meInsightsApi } from "@/api/moments/moments.api";
import type { InsightsView } from "@/api/moments/moments.types";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/*
 * /studio/analytics — 创作数据分析 (Phase 2L)
 *
 * Data source is the ALREADY-MIGRATED `meInsightsApi.get()`
 * (`GET /api/v1/me/insights`), which /me/moments also consumes. No new API.
 *
 * ⚠️ Legacy's page was a 42-line stub: it painted `"—"` for every card whenever
 * the request failed AND whenever it succeeded-but-was-slow, because the only
 * states it modelled were "insights" and "not insights yet". So a failed load
 * was visually identical to a loading one — the user could not tell "0" from
 * "we could not find out". This page separates the three states explicitly:
 * loading / failed / loaded. On failure it says the numbers could not be read
 * rather than showing dashes that look like real zeros.
 *
 * ⚠️ `InsightsView` has SIX counters. Legacy only showed three (articleCount,
 * likeCount, commentCount). We surface all six rather than silently dropping
 * followerCount / followingCount / draftCount, which the API already returns.
 */

type InsightsState =
  { kind: "loading" } | { kind: "error" } | { kind: "ready"; insights: InsightsView };

export function StudioAnalyticsPage() {
  const [state, setState] = useState<InsightsState>({ kind: "loading" });
  // Drafts are a secondary nicety: a failed list must not blank the counters.
  const [drafts, setDrafts] = useState<MyArticleSummary[] | null>(null);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    meInsightsApi
      .get()
      .then((insights) => {
        if (active) setState({ kind: "ready", insights });
      })
      .catch(() => {
        if (active) setState({ kind: "error" });
      });

    articlesApi
      .listMine()
      .then((rows) => {
        if (active) setDrafts(rows);
      })
      .catch(() => {
        if (active) setDrafts(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const unreviewed = drafts?.filter((d) => (d.status ?? "").toUpperCase() === "DRAFT") ?? null;

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio" className="hover:text-foreground">
          创作中心
        </Link>
        <span aria-hidden="true"> / </span>
        <span>数据分析</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">创作数据分析</h1>
        <p className="text-sm text-muted-foreground">汇总你的创作与互动数据。</p>
      </header>

      {state.kind === "loading" ? <PageState kind="loading" /> : null}

      {state.kind === "error" ? (
        <PageState
          kind="error"
          title="数据加载失败"
          // Says plainly that we do not know, instead of printing dashes that
          // read as zeros. This is the specific Legacy failure mode.
          description="暂时无法读取你的创作数据，因此这里不显示任何数字。请稍后重试。"
        />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <ul aria-label="创作数据" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="已发布文章" value={state.insights.articleCount} unit="篇" />
            <Stat label="草稿" value={state.insights.draftCount} unit="篇" />
            <Stat label="获得喜欢" value={state.insights.likeCount} />
            <Stat label="收到评论" value={state.insights.commentCount} />
            <Stat label="粉丝" value={state.insights.followerCount} />
            <Stat label="关注" value={state.insights.followingCount} />
          </ul>

          <p className="text-xs text-muted-foreground">
            以上数字由服务端汇总，可能会有一小段延迟。
          </p>
        </>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-foreground">稿件状态</h2>
          {drafts === null ? (
            <p className="text-sm text-muted-foreground" data-testid="drafts-unavailable">
              暂时无法读取稿件列表，因此这里不显示数量。
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              共有 {drafts.length} 篇稿件，其中 {unreviewed?.length ?? 0} 篇是尚未提交审核的草稿。
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-2">
            {/* ⚠️ No link to a "/studio/content" list — that route does not exist
                (only /studio/content/:articleId does). Linking to it would be a
                guaranteed 404, so the only entry point offered is the one that
                works. */}
            <Link
              to="/studio/submissions"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              我的投稿
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-primary">
        {value}
        {unit ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        ) : null}
      </p>
    </li>
  );
}
