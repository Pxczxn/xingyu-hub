import { useEffect, useMemo, useState } from "react";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { PageHero } from "@/components/shared/PageHero";
import { SeriesDirectoryItem } from "../components/SeriesDirectoryItem";

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
      <PageHero
        eyebrow="SERIES"
        title="系列广场"
        description="沿着一条主题线索，完整读完一个系列。"
        compact
      />

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有公开的系列"
          description="系列内容正在汇集，先去探索感兴趣的话题与创作者。"
        />
      ) : (
        <>
          <div
            className="flex items-center gap-5 border-b border-border/70"
            role="group"
            aria-label="系列排序"
          >
            {(
              [
                ["default", "全部系列"],
                ["recent", "最近更新"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSort(mode)}
                className={
                  sort === mode
                    ? "border-b-2 border-accent pb-2 text-sm font-medium text-primary"
                    : "border-b-2 border-transparent pb-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <ul className="rounded-xl border border-border/60 bg-card/70 px-4 sm:px-5">
            {visible.map((item, index) => (
              <SeriesDirectoryItem key={item.id} item={item} index={index} />
            ))}
          </ul>

          {items.length > visibleCount ? (
            <div className="text-center">
              <button
                type="button"
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                加载更多系列
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
