import { useEffect, useState } from "react";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { PageState } from "@/components/shared/PageState";
import { PageHero } from "@/components/shared/PageHero";
import { Button } from "@/components/ui/button";
import { SeriesDirectoryItem } from "../components/SeriesDirectoryItem";

type LoadState = "loading" | "error" | "ready";

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
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
  }, [reloadKey]);

  const visible = items.slice(0, visibleCount);

  if (loadState === "loading") return <PageState kind="loading" />;
  if (loadState === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

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
          <h2 className="border-b border-border/70 pb-2 text-sm font-medium text-primary">
            全部系列
          </h2>

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
