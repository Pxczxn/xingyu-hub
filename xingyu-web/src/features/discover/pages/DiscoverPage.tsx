import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { discoverApi } from "@/api/discover/discover.api";
import type { ContentSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { topicsApi } from "@/api/topics/topics.api";
import { PageState } from "@/components/shared/PageState";
import type { SectionStatus } from "@/components/shared/SectionState";
import { DiscoverHero } from "@/features/discover/components/DiscoverHero";
import { ExploreTopics } from "@/features/discover/components/ExploreTopics";
import { DiscoverFocusGrid } from "@/features/discover/components/DiscoverFocusGrid";

/*
 * Discover (Phase 1A, revised after live acceptance).
 *
 * Uses GET /api/v1/discover (verified 200, PageResult<ContentSummary>).
 * The previous /api/v1/explore/feed call returns 500 INTERNAL_ERROR on the
 * current backend, so it is not used.
 *
 * The discover nav endpoint exposes domain/sort tabs, but they are deliberately
 * not rendered: the current discover endpoint does not honour those filters.
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
        setLoadMoreError("分页链接已失效，已显示全部可加载内容；刷新页面可从头浏览。");
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
  }, []);

  return (
    <div className="section-gap gap-5">
      <DiscoverHero />
      <ExploreTopics status={topicsStatus} topics={topics} />

      {loading ? <PageState kind="loading" /> : null}
      {!loading && error ? <PageState kind="error" /> : null}
      {!loading && !error && items.length === 0 ? <PageState kind="empty" /> : null}

      {!loading && !error && items.length > 0 ? <DiscoverFocusGrid items={items} /> : null}

      {!loading && !error && loadMoreError ? (
        <p role="alert" className="pt-2 text-center text-sm text-destructive">
          {loadMoreError}
        </p>
      ) : null}

      {!loading && !error && nextCursor ? (
        <div className="pt-2 text-center">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMore()}>
            {loadingMore ? "正在加载…" : "加载更多"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
