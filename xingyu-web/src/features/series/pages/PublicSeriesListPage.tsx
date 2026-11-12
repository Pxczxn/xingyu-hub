import { useEffect, useState } from "react";
import { ArchetypeFrame } from "@/components/layout";
import { PageHero } from "@/components/shared/PageHero";
import { PageSection } from "@/components/shared/PageSection";
import { SearchField } from "@/components/shared/SearchField";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { SeriesWorkCard } from "../components/SeriesWorkCard";
import { useSeriesFeed } from "../useSeriesFeed";

/** Wait for typing to settle before asking the server. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Public series plaza.
 *
 * Backend: GET /api/v1/series/search?q=&limit=&cursor= (2026-10-18).
 *
 * Two independent feeds, not one mutable list:
 *
 *   browse — no keyword, ordered by recently updated. Owns its own cursor, so
 *            the loaded depth survives a search.
 *   search — the debounced keyword. The SERVER matches the whole public
 *            collection; filtering the rows already on screen would only ever
 *            search the first page.
 *
 * The previous implementation grew the `limit` from 24 to 48 to 72 and
 * refetched. Two defects came with that: the "load more" button rendered only
 * while `visibleCount < items.length`, so at exactly 24 rows it disappeared and
 * the rest of the catalogue was unreachable; and the refetch went through the
 * page-level loading state, which replaced the list with a spinner. A keyset
 * cursor fixes the first (the server says whether a next page exists), and an
 * append-only `loadMore` fixes the second (nothing already rendered is rebuilt).
 */
export function PublicSeriesListPage() {
  const [keyword, setKeyword] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(keyword.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const searching = query.length > 0;
  /* Always enabled: the browse list must stay intact while a search is shown,
     so clearing the keyword restores it instead of refetching from page one. */
  const browse = useSeriesFeed("", true);
  const search = useSeriesFeed(query, searching);
  const feed = searching ? search : browse;
  /* "No public series at all" is a page-level state: there is nothing to search
     yet, so the section (and its search field) would be an empty promise. */
  const catalogEmpty =
    !searching &&
    !browse.loading &&
    !browse.error &&
    browse.items.length === 0 &&
    browse.total === 0;

  /*
   * SK2 画廊 · H=幅 / D=松 / R=齐（`.team/design/A-archetypes.md` §3 的
   * /series/* 域 PublicSeriesList 行）。骨架由 `ArchetypeFrame` 提供：页面只声明
   * 身份，不再手写 `section-gap` / `max-w-*`。
   *
   *   H=幅：页头是 `PageHero`（有面横幅、自带 `<h1>`）。原来是 `PageMasthead`
   *   —— 那是 H=线 的构件，用在「幅」上等于把本页和系列详情（同为 SK1/线 一族）
   *   画成了同一种开头。`motif-orbit` 给它一块几何轨道母题（B §6：一页 ≤1 种
   *   母题，本页只有这一处）。
   *   D=松：`density="loose"` 让卡面之间的间距走 `--density-grid-gap`，而不是
   *   手写 16/20px；每张卡仍是独立卡面（`SeriesWorkCard` 自带的 `rounded-xl`）。
   *   R=齐：没有 `rail`，所以 frame 退回单列、与内容列同宽同边 —— 本页不做出血带
   *   （那是 R=出），也不做侧轨（那是 R=错）。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <PageHero
          eyebrow="SERIES"
          title="系列广场"
          description="沿着一条主题线索，完整读完一个系列。"
          className="motif-orbit"
        />
      }
    >
      {catalogEmpty ? (
        <PageState
          kind="empty"
          title="还没有公开的系列"
          description="系列内容正在汇集，先去探索感兴趣的话题与创作者。"
        />
      ) : (
        <PageSection
          id="all-series"
          title={searching ? "搜索结果" : "探索系列"}
          count={feed.total ?? undefined}
          action={
            <SearchField
              value={keyword}
              onChange={setKeyword}
              ariaLabel="搜索系列"
              placeholder="搜索系列名称、简介或作者"
            />
          }
          actionClassName="w-full sm:w-auto"
        >
          {feed.loading ? <PageState kind="loading" /> : null}

          {!feed.loading && feed.error ? (
            <div className="flex flex-col items-center gap-3">
              <PageState kind="error" className="w-full" />
              <Button variant="outline" onClick={feed.reload}>
                重新加载
              </Button>
            </div>
          ) : null}

          {!feed.loading && !feed.error && feed.items.length === 0 ? (
            searching ? (
              <p
                role="status"
                className="rounded-lg border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground"
              >
                没有匹配「{query}」的系列，换个关键词试试。
              </p>
            ) : (
              <PageState kind="empty" title="还没有公开的系列" />
            )
          ) : null}

          {!feed.loading && !feed.error && feed.items.length > 0 ? (
            <>
              {/*
                Two columns from `lg` up, one below it. A tablet in portrait is
                closer to a phone than to a desk: at 768px a two-column split
                leaves ~140px for the text and pushes the author onto its own
                footer line, so the breakpoint sits where a card can actually
                hold a title, a blurb and a fact row. Equal heights come from
                the grid (`items-stretch` is the default); nothing inside is
                fixed-height.
              */}
              <ul
                data-testid="series-work-grid"
                className="grid list-none grid-cols-1 gap-[var(--density-grid-gap)] p-0 lg:grid-cols-2"
              >
                {feed.items.map((item) => (
                  <SeriesWorkCard key={item.id} item={item} />
                ))}
              </ul>

              {/*
                The button is driven by `nextCursor`, never by comparing the
                visible count with the loaded count: those are equal at every
                page boundary, which is exactly when the remainder was lost.
              */}
              {feed.nextCursor ? (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <Button variant="outline" onClick={feed.loadMore} disabled={feed.loadingMore}>
                    {feed.loadingMore ? "正在加载…" : "加载更多系列"}
                  </Button>
                  {feed.loadMoreError ? (
                    <p role="alert" className="text-meta text-destructive">
                      {feed.loadMoreError}
                    </p>
                  ) : null}
                </div>
              ) : feed.loadMoreError ? (
                <p role="alert" className="mt-4 text-center text-meta text-destructive">
                  {feed.loadMoreError}
                </p>
              ) : null}
            </>
          ) : null}
        </PageSection>
      )}
    </ArchetypeFrame>
  );
}
