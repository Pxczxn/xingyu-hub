import { useEffect, useMemo, useState } from "react";
import { seriesApi } from "@/api/series/series.api";
import type { PublicSeriesSummary } from "@/api/series/series.types";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageSection } from "@/components/shared/PageSection";
import { SearchField } from "@/components/shared/SearchField";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesDirectoryItem } from "../components/SeriesDirectoryItem";

type LoadState = "loading" | "error" | "ready";

const PAGE_SIZE = 8;
/** The fetch window: the API takes a plain `limit`, so paging starts client-side. */
const WINDOW_SIZE = 24;
/** When the fetched window is exhausted, grow it by this much and refetch. */
const WINDOW_STEP = 24;

/**
 * Public series plaza (Phase 2G).
 *
 * Backend: GET /api/v1/series?limit=N -> PublicSeriesSummary[].
 * The endpoint is guest-readable and has no cursor: `limit` is the only knob.
 * The list is ordered by the service (recently updated first) and shown as a
 * table of contents; search filters the fetched window client-side, matching
 * the topics plaza semantics.
 */
export function PublicSeriesListPage() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [items, setItems] = useState<PublicSeriesSummary[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [windowSize, setWindowSize] = useState(WINDOW_SIZE);
  const [keyword, setKeyword] = useState("");
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadState("loading");
    seriesApi
      .listPublic(windowSize)
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
  }, [reloadKey, windowSize]);

  const searching = keyword.trim().length > 0;
  const matches = useMemo(() => {
    if (!searching) return items;
    const query = keyword.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        item.author.username.toLowerCase().includes(query) ||
        (item.author.displayName ?? "").toLowerCase().includes(query),
    );
  }, [items, keyword, searching]);

  /* While searching, every match is reachable — pagination over an already
     filtered client-side list would just hide what the reader asked for. */
  const visible = searching ? matches : items.slice(0, visibleCount);
  const windowExhausted = !searching && items.length >= windowSize;

  const handleLoadMore = () => {
    if (visibleCount < items.length) {
      setVisibleCount((count) => count + PAGE_SIZE);
      return;
    }
    if (windowExhausted) {
      /* Optimistically grow both knobs so the refetch appends rather than
         rewinds: after 48 items arrive, the visible count is already past 24. */
      setWindowSize((size) => size + WINDOW_STEP);
      setVisibleCount((count) => count + PAGE_SIZE);
    }
  };

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
      <PageMasthead
        eyebrow="SERIES"
        title="系列广场"
        description="沿着一条主题线索，完整读完一个系列。"
      />

      {items.length === 0 ? (
        <PageState
          kind="empty"
          title="还没有公开的系列"
          description="系列内容正在汇集，先去探索感兴趣的话题与创作者。"
        />
      ) : (
        <PageSection
          id="all-series"
          title={searching ? "搜索结果" : "全部系列"}
          count={matches.length}
          action={
            <SearchField
              value={keyword}
              onChange={setKeyword}
              ariaLabel="搜索系列"
              placeholder="搜索系列名称或简介"
            />
          }
        >
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              没有匹配「{keyword.trim()}」的系列，换个关键词试试。
            </p>
          ) : (
            <ul className="rounded-xl border border-border/60 bg-card/70 px-4 sm:px-5">
              {visible.map((item) => (
                <SeriesDirectoryItem key={item.id} item={item} />
              ))}
            </ul>
          )}

          {!searching && visibleCount < items.length ? (
            <div className="text-center">
              <button
                type="button"
                className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                onClick={handleLoadMore}
              >
                加载更多系列
              </button>
            </div>
          ) : null}
        </PageSection>
      )}
    </div>
  );
}
