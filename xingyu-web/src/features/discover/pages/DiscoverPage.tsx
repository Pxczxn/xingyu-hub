import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { discoverApi } from "@/api/discover/discover.api";
import type { ContentSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { topicsApi } from "@/api/topics/topics.api";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import type { SectionStatus } from "@/components/shared/SectionState";
import { ExploreTopics } from "@/features/discover/components/ExploreTopics";
import { DiscoverFocusGrid } from "@/features/discover/components/DiscoverFocusGrid";
import { cn } from "@/lib/cn";

/*
 * Discover (Phase 1A, revised after live acceptance).
 *
 * Uses GET /api/v1/discover (verified 200, PageResult<ContentSummary>).
 * The previous /api/v1/explore/feed call returns 500 INTERNAL_ERROR on the
 * current backend, so it is not used.
 *
 * The discover nav endpoint exposes domain/sort tabs, but they are deliberately
 * not rendered: the current discover endpoint does not honour those filters.
 *
 * 2026-10-13 (layout batch 02): the reading order is now 说明行 → 精选 → 探索入口.
 * Two things changed and one deliberately did not:
 *
 *   - The opening block left the banner. `DiscoverHero` was a `PageHero compact`
 *     wrapper, so the page opened with a bordered card that carried an eyebrow, a
 *     24px title and a description — and the content the page exists to show began
 *     below it. It is now `PageMasthead`, the same no-surface opening Home adopted
 *     in A0, for the same reason: this page's first screen has to hand the reader
 *     to content, not to a framed statement about the content.
 *   - The topic block moved from above the content to below it. It is an exit, not
 *     an entrance — a reader who came to browse should not have to scroll past a
 *     navigation block to reach the thing they came for.
 *   - `DiscoverFocusGrid` was NOT rewritten. It already splits by the server's
 *     `featured` flag, already weights primary 1.5fr against a 1fr secondary stack,
 *     and already degrades honestly at 0/1/2/3+ picks. Re-expressing that as a
 *     different grid template would have been a rewrite with no reader-visible gain.
 */
export function DiscoverPage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicsStatus, setTopicsStatus] = useState<SectionStatus>("loading");
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  /*
   * Retry is "run the first-page effect again". That effect already owns the
   * loading/error transitions, so bumping this key replays the exact request
   * path — no second copy of the fetch in an onClick that could drift.
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    topicsApi
      .getTopics()
      .then((data) => {
        if (!active) return;
        setTopics(data);
        setTopicsStatus(data.length > 0 ? "ready" : "empty");
      })
      .catch(() => {
        if (active) setTopicsStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await discoverApi.getDiscover({ cursor: nextCursor, limit: 20 });
      // 去重键 = objectType + id（同一 objectId 可同时存在 ARTICLE 与 SERIES 文档）
      const seen = new Set(items.map((item) => `${item.objectType ?? ""}:${item.id}`));
      const fresh = (page.items ?? []).filter(
        (item) => !seen.has(`${item.objectType ?? ""}:${item.id}`),
      );
      setItems((prev) => [...prev, ...fresh]);
      setNextCursor(page.nextCursor ?? null);
    } catch (err) {
      // 保留已有内容；游标失效（400）时关闭翻页入口，其余失败保留按钮可重试
      if (err instanceof ApiError && err.problem.status === 400) {
        setNextCursor(null);
        setLoadMoreError("分页链接无效，请刷新页面从第一页重新浏览。");
      } else {
        setLoadMoreError("加载更多失败，请重试。");
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, items]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    discoverApi
      .getDiscover({ limit: 20 })
      .then((page) => {
        if (!active) return;
        setItems(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="section-gap gap-5">
      {/*
       * P3 说明行. Deliberately not a section of the feed: it shares the column's
       * left edge with the content below (no card, no border), so 陈述 → 选择 → 内容
       * reads as one column rather than three stacked bands.
       */}
      <PageMasthead
        eyebrow="EXPLORE"
        title="发现"
        description="从话题与内容出发，探索社区里正在发生的事。"
      />

      {/* P0: the picks. Everything above this line is a caption for them. */}
      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? (
        /*
         * Error carries its own retry — the same PageState + 重新加载 pair
         * GalaxyShell:276 renders around `useGalaxy().retry`. The button
         * bumps `reloadKey`, which replays the first-page effect; without it
         * a failed first load left a manual page refresh as the only way out.
         */
        <div className="section-gap-tight">
          <PageState kind="error" />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </div>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        /*
         * The empty state carries its OWN exit, and that is not redundancy with
         * the 探索话题 row below: `ExploreTopics` renders nothing when no topic
         * has content (`:44`, `:65`), and an empty feed means every topic count
         * is 0 — so on this state the page would otherwise be 暂无内容 + artwork
         * and nothing else. The copy reframes the state (生长中, not 失败) and
         * the button is the one action that makes the page stop being empty; it
         * points where the header's 创作 button already does.
         *
         * Shape (`section-gap-tight` + centred `buttonVariants` link) follows
         * NewReportPage:126 and GalaxyShell:288, the two existing 空状态+出口
         * pairs. Tighter than their `section-gap` because this button is an
         * attachment to the state above it, not a second block.
         */
        <div className="section-gap-tight">
          <PageState
            kind="empty"
            title="社区还在生长中"
            description="还没有内容可以浏览。成为第一个分享的人吧。"
          />
          <p className="text-center">
            <Link to="/studio" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>
              去创作
            </Link>
          </p>
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? <DiscoverFocusGrid items={items} /> : null}

      {!loading && !error && loadMoreError ? (
        <p role="alert" className="pt-2 text-center text-sm text-destructive">
          {loadMoreError}
        </p>
      ) : null}

      {!loading && !error && nextCursor ? (
        <div className="pt-2 text-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "正在加载…" : "加载更多"}
          </Button>
        </div>
      ) : null}

      {/*
       * P2 探索入口, and last on purpose.
       *
       * It sits AFTER the feed's own continuation control rather than between the
       * picks and that control: a reader still working through the feed should meet
       * 「加载更多」, not a way out of the page. A reader who has scrolled past it has
       * signalled they are done here, and that is the moment to offer topics.
       *
       * It is also the only thing on the page when the feed is EMPTY — the empty
       * state plus this block gives a reader somewhere to go instead of a dead end.
       * That is the reason the section stays mounted through the loading/error/empty
       * branches instead of being nested under the success branch.
       */}
      <ExploreTopics status={topicsStatus} topics={topics} />
    </div>
  );
}
