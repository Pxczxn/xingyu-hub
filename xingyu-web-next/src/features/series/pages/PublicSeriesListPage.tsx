import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { formatUpdatedAt, seriesStatusLabel } from "../series-labels";

type LoadState = "loading" | "error" | "ready";

type SortMode = "default" | "recent";

const PAGE_SIZE = 8;

/**
 * Public series marketplace (Phase 2G).
 *
 * Backend: GET /api/v1/series?limit=N -> PublicSeriesSummary[].
 * The endpoint is guest-readable and has no cursor: `limit` is the only knob,
 * so paging is client-side over the fetched window.
 */
export function PublicSeriesListPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<PublicSeriesSummary[]>([]);
  const [sort, setSort] = useState<SortMode>("default");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let active = true;
    seriesApi
      .listPublic(24)
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

  const visible = useMemo(() => {
    const list = [...items];
    if (sort === "recent") {
      list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }
    return list.slice(0, visibleCount);
  }, [items, sort, visibleCount]);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") return <PageState kind="error" />;

  return (
    <div className="section-gap">
      <header>
        <h1 className="text-xl font-semibold text-primary">系列广场</h1>
        <p className="mt-1 text-sm text-muted-foreground">按主题浏览长篇内容。</p>
      </header>

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有公开的系列"
          description="系列内容正在汇集，先去探索感兴趣的话题与创作者。"
        />
      ) : (
        <>
          <div className="flex gap-2">
            {(
              [
                ["default", "全部系列"],
                ["recent", "最近更新"],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                variant={sort === mode ? "primary" : "outline"}
                size="sm"
                onClick={() => setSort(mode)}
              >
                {label}
              </Button>
            ))}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {visible.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/series/${encodeURIComponent(item.id)}`}
                  className="block rounded-lg border border-border bg-card p-4 hover:border-accent"
                >
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{seriesStatusLabel(item.status)}</span>
                    <span>{`${item.chapterCount} 篇文章`}</span>
                    <span>{formatUpdatedAt(item.updatedAt)}</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {items.length > visibleCount ? (
            <div className="text-center">
              <Button variant="outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                加载更多系列
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
