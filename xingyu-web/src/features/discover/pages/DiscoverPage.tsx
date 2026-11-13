import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { discoverApi } from "@/api/discover/discover.api";
import type { DiscoverInput, DiscoverSort } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { topicsApi } from "@/api/topics/topics.api";
import { PageState } from "@/components/shared/PageState";
import { DiscoverFrame } from "@/features/discover/components/DiscoverFrame";
import { DiscoverSidebar } from "@/features/discover/components/DiscoverSidebar";
import { DiscoverListItem } from "@/features/discover/components/DiscoverListItem";
import { DiscoverReadingSheet } from "@/features/discover/components/DiscoverReadingSheet";
import { cn } from "@/lib/cn";
import "../discover.css";

const itemKey = (item: ContentSummary) => `${item.objectType ?? ""}:${item.id}`;

function DiscoverFeedSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="page-state-loading"
      className="flex flex-col gap-4"
    >
      <span className="sr-only">正在加载…</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="animate-pulse border-b border-slate-100 py-8 last:border-0">
          <div className="mb-2 h-5 w-2/3 rounded bg-gray-100" />
          <div className="mb-1 h-4 w-full rounded bg-gray-100" />
          <div className="h-4 w-5/6 rounded bg-gray-100" />
          <div className="mt-3 h-3 w-40 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get("topic") ?? "";
  const rawType = searchParams.get("type");
  const parsedType: DiscoverInput["type"] =
    rawType === "ARTICLE" || rawType === "SERIES" || rawType === "MOMENT" ? rawType : undefined;
  /*
   * 话题只归类文章：后端 `listDiscoverFiltered` 在带 topic 时硬编码
   * `object_type = 'ARTICLE'`（话题关联表只有 `article_topic`），所以
   * `?topic=x&type=MOMENT` 永远返回空列表。把这种残留组合解释成「该话题内的全部文章」，
   * 而不是把「数据模型不支持」显示成「暂无符合筛选条件的内容」。
   */
  const topicOverridesType = Boolean(topic) && (parsedType === "MOMENT" || parsedType === "SERIES");
  const type: DiscoverInput["type"] = topicOverridesType ? undefined : parsedType;
  const rawSort = searchParams.get("sort");
  const sort: DiscoverSort = rawSort === "featured" || rawSort === "interest" ? rawSort : "latest";
  const discoverInput = useCallback(
    (cursor?: string): DiscoverInput => {
      const input: DiscoverInput = { limit: 20 };
      if (cursor) input.cursor = cursor;
      if (topic) input.topic = topic;
      if (type) input.type = type;
      if (sort !== "latest") input.sort = sort;
      return input;
    },
    [topic, type, sort],
  );
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicsError, setTopicsError] = useState(false);
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Sheet state for reading panel
  const [selectedItem, setSelectedItem] = useState<ContentSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    let active = true;
    topicsApi
      .getTopics()
      .then((data) => {
        if (active) setTopics(data);
      })
      .catch(() => {
        if (active) setTopicsError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // 清掉 URL 里残留的「话题 + 动态/系列」组合：页面已经按“话题内文章”加载，
  // 地址栏再留着 type 会让分享出去的链接把同一个无效组合带给别人。
  useEffect(() => {
    if (!topicOverridesType) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("type");
        return next;
      },
      { replace: true },
    );
  }, [topicOverridesType, setSearchParams]);

  const changeFilter = (key: "topic" | "type", value: string) => {
    const current = key === "topic" ? topic : (type ?? "");
    if (current === value) return;
    // Invalidate pending pagination immediately, before the next effect runs.
    requestVersion.current += 1;
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const changeSort = (next: "latest" | "featured" | "interest") => {
    if (next === sort) return;
    requestVersion.current += 1;
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next === "latest") params.delete("sort");
      else params.set("sort", next);
      return params;
    });
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await discoverApi.getDiscover(discoverInput(nextCursor));
      if (version !== requestVersion.current) return;
      setItems((previous) => {
        const seen = new Set(previous.map((item) => `${item.objectType ?? ""}:${item.id}`));
        const fresh = (page.items ?? []).filter((item) => {
          const key = `${item.objectType ?? ""}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return [...previous, ...fresh];
      });
      setNextCursor(page.nextCursor ?? null);
    } catch (err) {
      if (version !== requestVersion.current) return;
      if (err instanceof ApiError && err.problem.status === 400) {
        setNextCursor(null);
        setLoadMoreError("分页链接无效，请刷新页面从第一页重新浏览。");
      } else {
        setLoadMoreError("加载更多失败，请重试。");
      }
    } finally {
      if (version === requestVersion.current) setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, discoverInput]);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(false);
    setNeedsLogin(false);
    setItems([]);
    setNextCursor(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    discoverApi
      .getDiscover(discoverInput())
      .then((page) => {
        if (!active || version !== requestVersion.current) return;
        setItems(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || version !== requestVersion.current) return;
        if (
          err instanceof ApiError &&
          (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
        ) {
          setNeedsLogin(true);
        } else {
          setError(true);
        }
        setLoading(false);
      });
    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [reloadKey, discoverInput]);

  const isFiltered = Boolean(topic || type || sort !== "latest");

  return (
    <DiscoverFrame title="发现" description="顺着话题，把下一篇想读完的文章找出来。">
        <div className="discover-layout grid grid-cols-1 gap-8 md:grid-cols-12">
          <DiscoverSidebar
            className="md:col-span-3"
            activeTopic={topic}
            onTopicChange={(value) => changeFilter("topic", value)}
            sort={sort}
            onSortChange={changeSort}
            contentType={type ?? "ALL"}
            onContentTypeChange={(value) => changeFilter("type", value === "ALL" ? "" : value)}
            topics={topics}
            topicsError={topicsError}
          />
          <div
            className="min-w-0 md:col-span-9"
            aria-label="发现内容"
            aria-busy={loading || loadingMore}
          >
          {loading && <DiscoverFeedSkeleton />}
          {!loading && needsLogin && (
            <div className="section-gap-tight">
              <PageState
                kind="empty"
                title="登录后查看兴趣相关"
                description="按你选择的探索方向筛选公开文章。"
              />
              <div className="text-center">
                <Link to="/login" className={cn(buttonVariants({ variant: "accent" }))}>
                  去登录
                </Link>
              </div>
            </div>
          )}
          {!loading && error && (
            <div className="section-gap-tight">
              <PageState kind="error" />
              <div className="text-center">
                <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                  重新加载
                </Button>
              </div>
            </div>
          )}
          {!loading && !error && !needsLogin && items.length === 0 && (
            <div className="section-gap-tight">
              <PageState
                kind="empty"
                title={isFiltered ? "暂无符合筛选条件的内容" : "社区还在生长中"}
                description={
                  isFiltered
                    ? "试试其他话题或内容类型。"
                    : "还没有内容可以浏览。成为第一个分享的人吧。"
                }
              />
              {!isFiltered && (
                <p className="text-center">
                  <Link
                    to="/studio"
                    className={cn(buttonVariants({ variant: "outline" }), "text-meta")}
                  >
                    去创作
                  </Link>
                </p>
              )}
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <ul className="flex flex-col">
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <li key={key} className="border-b border-slate-100 last:border-0">
                    <DiscoverListItem
                      item={item}
                      onToggleExpand={() => {
                        setSelectedItem(item);
                        setSheetOpen(true);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && !error && loadMoreError && (
            <p role="alert" className="pt-2 text-right text-meta text-danger">
              {loadMoreError}
            </p>
          )}
          {!loading && !error && nextCursor && (
            <div className="mt-6 flex items-center justify-end">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => void loadMore()}
                className="px-6"
              >
                {loadingMore ? "正在加载…" : "加载更多"}
              </Button>
            </div>
          )}
          </div>
        </div>

      <DiscoverReadingSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedItem(null);
        }}
      />
    </DiscoverFrame>
  );
}
