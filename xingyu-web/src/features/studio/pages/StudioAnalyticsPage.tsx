import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { meInsightsApi } from "@/api/moments/moments.api";
import type { InsightsView } from "@/api/moments/moments.types";
import { articlesApi } from "@/api/articles/articles.api";
import type { MyArticleSummary } from "@/api/articles/articles.types";
import { ArchetypeFrame, TableFrame } from "@/components/layout";
import { PageSection } from "@/components/shared/PageSection";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { articleStatusLabel } from "@/features/studio/content-list";

/*
 * /studio/analytics — 创作数据分析 (Phase 2L; 骨架迁移 SK3 · 壳/表/齐)
 *
 * ARCHETYPE: SK3 控制台 (A §1). Anatomy is exactly two blocks —
 *   1) 量化带: the six counters, side by side, one surface;
 *   2) 结构化主区: a comparable table (D = 表), the draft status breakdown.
 * H is 壳: the studio workbench owns the area chrome, so this page renders NO
 * visible page title and the band IS the first block.
 * R is 齐: no rail — every block is the full width of the content column, which
 * is what `ArchetypeFrame skeleton="SK3"` gives when no `rail` is passed.
 *
 * ⚠️ WHY THE `<h1>` IS STILL THERE BUT `sr-only`
 * `WorkbenchShell` renders the 200px rail + `<Outlet />` and NOTHING else — it
 * deliberately carries no heading (`WorkbenchShell.tsx:15-29`, pinned by a
 * `studio-2n-routes.test.tsx` counter-assertion). So "the shell already has a
 * header" is false here: dropping the `<h1>` outright would leave the page with
 * zero headings, break A §5 判定 5 (每页恰有 1 个 h1), and break
 * `router/studio-2l-routes.test.tsx:100`, which resolves this route by
 * `findByRole("heading", { name: "创作数据分析" })`. Keeping it visually hidden
 * satisfies both: no competing 大标题 on screen, one heading for assistive tech.
 * The breadcrumb went away for the same reason — `StudioNav` already marks
 * 数据分析 as the active destination, so the crumb only delayed the band.
 *
 * DATA: `meInsightsApi.get()` (`GET /api/v1/me/insights`), the same endpoint
 * /me/moments consumes. NO new API, no changed request, no changed state machine.
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
 * likeCount, commentCount). The band surfaces all six rather than silently
 * dropping followerCount / followingCount / draftCount, which the API returns.
 */

type InsightsState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; insights: InsightsView };

/*
 * The 量化带, in the order an author actually looks at these numbers.
 * Keys are `keyof InsightsView`, so adding/renaming an API field is a type error
 * here instead of a silently missing cell.
 */
const METRICS: ReadonlyArray<{ key: keyof InsightsView; label: string; unit?: string }> = [
  { key: "articleCount", label: "已发布文章", unit: "篇" },
  // 口径注记（Final Fix DI-2）：insights.draftCount 按 article.status 统计，
  // 包含回收站中 status 仍为 DRAFT 的稿件；下方「稿件状态」表基于 /me/articles
  // （不含回收站）。两个数字都真实，标签标明口径避免同页误读。
  { key: "draftCount", label: "草稿（含回收站）", unit: "篇" },
  { key: "likeCount", label: "获得喜欢" },
  { key: "commentCount", label: "收到评论" },
  { key: "followerCount", label: "粉丝" },
  { key: "followingCount", label: "关注" },
];

type StatusRow = { label: string; count: number; share: number };

/*
 * Rows for the 稿件状态 table: one row per DISPLAYED status.
 *
 * Grouped by `articleStatusLabel` rather than by raw status because the label
 * map is what makes rows distinct (IN_REVIEW / REVIEW / REVIEWING are all
 * 审核中); grouping on the raw value would print two rows named 审核中. Unknown
 * statuses echo verbatim, exactly as the content list shows them.
 *
 * Not `countByStatus` from content-list.ts: that helper answers a different
 * question (three buckets for the overview panel) and would drop RETURNED and
 * any unrecognised status from a table whose whole point is the breakdown.
 */
function groupDraftsByStatus(drafts: MyArticleSummary[]): StatusRow[] {
  const counts = new Map<string, number>();
  for (const draft of drafts) {
    const label = articleStatusLabel(draft.status);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = drafts.length;
  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function StudioAnalyticsPage() {
  const [state, setState] = useState<InsightsState>({ kind: "loading" });
  // Drafts are a secondary nicety: a failed list must not blank the counters.
  const [drafts, setDrafts] = useState<MyArticleSummary[] | null>(null);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  const unreviewed = drafts?.filter((d) => (d.status ?? "").toUpperCase() === "DRAFT") ?? null;
  const statusRows = drafts && drafts.length > 0 ? groupDraftsByStatus(drafts) : [];
  const hasRows = statusRows.length > 0;

  /* A table of zero rows would be a blank frame with a header — the strongest
     lie a data page can tell. The shell hands the empty state to `PageState`
     and renders no table at all (TableFrame's contract). */
  const tableEmptyState =
    drafts === null ? (
      <p
        data-testid="drafts-unavailable"
        className="text-center text-meta leading-6 text-muted-foreground"
      >
        暂时无法读取稿件列表，因此这里不显示数量。
      </p>
    ) : (
      <PageState
        kind="empty"
        title="还没有稿件"
        description="写下第一篇之后，这里会按状态分组列出稿件数与占比。"
      />
    );

  return (
    <ArchetypeFrame skeleton="SK3" header="shell" density="dense">
      <h1 className="sr-only">创作数据分析</h1>

      {state.kind === "loading" ? <PageState kind="loading" /> : null}

      {state.kind === "error" ? (
        <div className="flex flex-col gap-3">
          <PageState
            kind="error"
            title="数据加载失败"
            // Says plainly that we do not know, instead of printing dashes that
            // read as zeros. This is the specific Legacy failure mode.
            description="暂时无法读取你的创作数据，因此这里不显示任何数字。请稍后重试。"
          />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </div>
      ) : null}

      {state.kind === "ready" ? (
        <div>
          {/* 量化带 — one surface, divided cells (gap-px over a border-coloured
              ground draws every hairline in any column count), not six cards:
              D=表 means the numbers get compared, so they must share a baseline
              grid instead of floating in individual frames. */}
          <div className="overflow-hidden rounded-card border border-border/70 bg-border/60">
            <ul
              aria-label="创作数据"
              className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6"
            >
              {METRICS.map((metric) => (
                <li key={metric.key} className="bg-card px-4 py-3">
                  <p className="text-meta text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-h2 tabular-nums text-primary">
                      {state.insights[metric.key]}
                    </span>
                    {metric.unit ? (
                      <span className="text-caption text-muted-foreground">{metric.unit}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-2 text-meta leading-6 text-muted-foreground">
            汇总你的创作与互动数据。以上数字由服务端汇总，可能会有一小段延迟。
          </p>
        </div>
      ) : null}

      <PageSection
        id="analytics-drafts"
        title="稿件状态"
        count={drafts?.length}
        description="按稿件列表统计，不含回收站；与上方「草稿（含回收站）」是两种口径。"
        contentClassName="flex flex-col gap-3"
      >
        {drafts && drafts.length > 0 ? (
          <p className="text-meta leading-6 text-muted-foreground">
            共有 {drafts.length} 篇稿件，其中 {unreviewed?.length ?? 0} 篇是尚未提交审核的草稿。
          </p>
        ) : null}

        {/*
          Both destinations exist, so both are offered. (The old comment here
          claimed linking to /studio/content "would be a guaranteed 404"; that was
          true when written and is not any more — the bare route is registered and
          renders ContentListPage.) They live in the table's toolbar slot so they
          stay reachable while the table is empty or unreadable.
        */}
        <TableFrame
          caption="稿件状态"
          emptyState={hasRows ? undefined : tableEmptyState}
          toolbar={
            <div className="flex flex-wrap gap-2">
              <Link
                to="/studio/content"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                查看全部内容
              </Link>
              <Link
                to="/studio/submissions"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                我的投稿
              </Link>
            </div>
          }
        >
          <thead>
            <tr>
              <th scope="col">状态</th>
              <th scope="col">稿件数</th>
              <th scope="col">占比</th>
            </tr>
          </thead>
          <tbody>
            {statusRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className="tabular-nums text-foreground">{row.count}</td>
                <td className="tabular-nums text-muted-foreground">{row.share}%</td>
              </tr>
            ))}
          </tbody>
        </TableFrame>
      </PageSection>
    </ArchetypeFrame>
  );
}
