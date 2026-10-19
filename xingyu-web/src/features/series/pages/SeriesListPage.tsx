import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, PenLine } from "lucide-react";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesSummary } from "@/api/series/series.types";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SeriesStatusBadge } from "../components/SeriesStatusBadge";
import { formatUpdatedAt } from "../series-labels";

type LoadState = "loading" | "error" | "ready";

/**
 * Creator series workbench (Phase 5A).
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

  return (
    <div className="section-gap">
      <PageHeader
        title="我的系列"
        description="把已有文章组织成有顺序的系列；这里管理的是编排和信息，不会修改文章正文。"
        actions={
          <Link to="/studio/series/new" className={cn(buttonVariants({ variant: "accent" }))}>
            创建系列
          </Link>
        }
      />

      {loadState === "loading" ? <PageState kind="loading" /> : null}

      {loadState === "error" ? (
        <div className="section-gap-tight">
          <PageState kind="error" description="系列列表加载失败，请稍后重试。" />
          <div>
            <Button variant="outline" onClick={load}>
              重新加载
            </Button>
          </div>
        </div>
      ) : null}

      {loadState === "ready" && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-10 text-center">
          <p className="text-base font-semibold text-primary">还没有系列</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            先创建一个系列，再把已有文章编排进去。创建后可以随时调整顺序和公开状态。
          </p>
          <Link
            to="/studio/series/new"
            className={cn(buttonVariants({ variant: "accent" }), "mt-4")}
          >
            创建第一个系列
          </Link>
        </div>
      ) : null}

      {loadState === "ready" && items.length > 0 ? (
        <ul className="grid gap-3" data-testid="series-rows">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border/70 bg-card p-4 transition-colors hover:border-border sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 break-words text-base font-semibold leading-6 text-primary">
                      {item.title}
                    </h2>
                    <SeriesStatusBadge status={item.status} />
                  </div>
                  {item.description ? (
                    <p className="mt-1.5 line-clamp-2 break-words text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">暂无简介</p>
                  )}
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
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

                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                  <Link
                    to={`/studio/series/${encodeURIComponent(item.id)}/articles`}
                    className={cn(buttonVariants({ variant: "default", size: "sm" }))}
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
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
