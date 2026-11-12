import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenLine } from "lucide-react";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesSummary } from "@/api/series/series.types";
import { ArchetypeFrame } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SeriesStatusBadge } from "../components/SeriesStatusBadge";
import { formatUpdatedAt } from "../series-labels";

type LoadState = "loading" | "error" | "ready";

/**
 * Creator series workbench (Phase 5A).
 *
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 紧 / R 错
 * --------------------------------------------------
 *   这一页的路由是 `/studio/series`，所以它属于 **studio 域**（A §7.5 的提醒：
 *   按路由认领，不按目录）—— 因此它和另外 9 个创作台页面一样落在 B 类壳里。
 *
 *   H=壳：`WorkbenchShell` 不输出 heading，页面必须自己给**恰好 1 个** `h1`。
 *        本页此前 `grep 'h1'` 无命中（A §7.2 点名的两处缺口之一），这里补上，
 *        且是 `sr-only` —— 首块是操作行与列表，视觉没有标题位。
 *   D=紧：每个系列是**一行**：无卡面、无逐项圆角，行与行靠一条发丝线分隔。
 *   R=错：主列 + 右侧 `SectionRail`（系列概览）。没有 rail 时 frame 会退成单列，
 *        所以概览只在真有系列时出现 —— 空态下它只能复述「0 个系列」。
 *
 * This is a management surface, not the public plaza: no cover artwork, no
 * decorative card grid, no invented subscriber/read counts. The primary action
 * on every row is "管理章节" because arranging the work is the job this page
 * exists for; "编辑信息" is secondary and the public page is a quiet third link.
 */
export function SeriesListPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<SeriesSummary[]>([]);

  const load = useCallback(() => {
    setLoadState("loading");
    seriesApi
      .listMine()
      .then((data) => {
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    let active = true;
    seriesApi
      .listMine()
      .then((data) => {
        if (!active) return;
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => {
        if (active) setLoadState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const activeCount = items.filter((item) => item.status === "ACTIVE").length;
  const archivedCount = items.filter((item) => item.status === "ARCHIVED").length;
  const chapterTotal = items.reduce((sum, item) => sum + (item.chapterCount ?? 0), 0);

  return (
    <ArchetypeFrame
      skeleton="SK3"
      header="shell"
      density="compact"
      railLabel="系列概览"
      rail={
        loadState === "ready" && items.length > 0 ? (
          <div className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-4">
            <dl className="flex flex-col gap-3 text-meta">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">系列总数</dt>
                <dd className="text-h3 tabular-nums text-primary">{items.length}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">公开</dt>
                <dd className="text-h3 tabular-nums text-primary">{activeCount}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">归档</dt>
                <dd className="text-h3 tabular-nums text-primary">{archivedCount}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">章节合计</dt>
                <dd className="text-h3 tabular-nums text-primary">{chapterTotal}</dd>
              </div>
            </dl>
            <p className="text-caption leading-5 text-muted-foreground">
              数字由本页列表直接汇总，不含阅读量或订阅人数。
            </p>
          </div>
        ) : undefined
      }
    >
      {/* B 类壳：恰好 1 个 h1，视觉隐藏；首块仍是内容。 */}
      <h1 className="sr-only">我的系列</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-meta leading-6 text-muted-foreground">
          把已有文章组织成有顺序的系列；这里管理的是编排和信息，不会修改文章正文。
        </p>
        <Link to="/studio/series/new" className={cn(buttonVariants({ size: "sm" }))}>
          创建系列
        </Link>
      </div>

      {loadState === "loading" ? <PageState kind="loading" /> : null}

      {loadState === "error" ? (
        <div className="flex flex-col items-start gap-3">
          <PageState kind="error" description="系列列表加载失败，请稍后重试。" />
          <Button variant="outline" onClick={load}>
            重新加载
          </Button>
        </div>
      ) : null}

      {loadState === "ready" && items.length === 0 ? (
        <div className="flex flex-col gap-3">
          <PageState
            kind="empty"
            title="还没有系列"
            description="先创建一个系列，再把已有文章编排进去。创建后可以随时调整顺序和公开状态。"
          />
          <div>
            <Link to="/studio/series/new" className={cn(buttonVariants({ size: "sm" }))}>
              创建第一个系列
            </Link>
          </div>
        </div>
      ) : null}

      {loadState === "ready" && items.length > 0 ? (
        <ul
          className="flex list-none flex-col divide-y divide-border/70 border-y border-border/70 p-0"
          data-testid="series-rows"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 py-[var(--density-list-gap)] sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-x-6"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 break-words text-h3 text-primary">{item.title}</h2>
                  <SeriesStatusBadge status={item.status} />
                </div>
                {item.description ? (
                  <p className="line-clamp-2 break-words text-meta leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                ) : (
                  <p className="text-meta text-muted-foreground">暂无简介</p>
                )}
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                  <span className="tabular-nums">{`${item.chapterCount} 章`}</span>
                  <span aria-hidden className="text-border">
                    ·
                  </span>
                  <span>{`更新于 ${formatUpdatedAt(item.updatedAt)}`}</span>
                  {item.status === "ARCHIVED" ? (
                    <>
                      <span aria-hidden className="text-border">
                        ·
                      </span>
                      <span>公开页暂不可访问</span>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  to={`/studio/series/${encodeURIComponent(item.id)}/articles`}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  管理章节
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to={`/studio/series/${encodeURIComponent(item.id)}/edit`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  <PenLine className="h-4 w-4" aria-hidden />
                  编辑信息
                </Link>
                {item.status === "ACTIVE" ? (
                  <Link
                    to={`/series/${encodeURIComponent(item.id)}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    查看公开页
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </ArchetypeFrame>
  );
}
