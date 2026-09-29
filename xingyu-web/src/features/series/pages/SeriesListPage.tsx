import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { SeriesSummary } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatUpdatedAt, seriesStatusLabel } from "../series-labels";

type LoadState = "loading" | "error" | "ready";

export function SeriesListPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<SeriesSummary[]>([]);

  function reload() {
    setLoadState("loading");
    seriesApi
      .listMine()
      .then((data) => {
        setItems(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }

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

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <Button variant="outline" onClick={reload}>
          重新加载
        </Button>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">我的系列</h1>
          <p className="mt-1 text-sm text-muted-foreground">把已有文章组织成系列。</p>
        </div>
        <Link to="/studio/series/new" className={cn(buttonVariants({ variant: "accent" }))}>
          创建系列
        </Link>
      </header>

      {items.length === 0 ? (
        <PageState kind="empty" title="还没有系列" description="先创建一个系列，再把文章编排进去。" />
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              ) : null}
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{seriesStatusLabel(item.status)}</span>
                <span>{`${item.chapterCount} 篇文章`}</span>
                <span>{formatUpdatedAt(item.updatedAt)}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  to={`/studio/series/${encodeURIComponent(item.id)}/edit`}
                  className="text-sm text-accent hover:underline"
                >
                  编辑
                </Link>
                <Link
                  to={`/studio/series/${encodeURIComponent(item.id)}/articles`}
                  className="text-sm text-accent hover:underline"
                >
                  文章编排
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

