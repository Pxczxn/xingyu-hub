import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
    try {
      const page = await discoverApi.getDiscover({ cursor: nextCursor, limit: 20 });
      // keyset 天然无重复，但内容在两次翻页之间被重新索引时仍可能重叠——按 id 去重防御
      const seen = new Set(items.map((item) => item.id));
      const fresh = (page.items ?? []).filter((item) => !seen.has(item.id));
      setItems((prev) => [...prev, ...fresh]);
      setNextCursor(page.nextCursor ?? null);
    } catch {
      // 加载更多失败保留当前页（不整页报错），按钮恢复可重试
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
