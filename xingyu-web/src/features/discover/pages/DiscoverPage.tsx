import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { discoverApi } from "@/api/discover/discover.api";
import type { DiscoverInput } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { topicsApi } from "@/api/topics/topics.api";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { DiscoverSidebar } from "@/features/discover/components/DiscoverSidebar";
import { DiscoverListItem } from "@/features/discover/components/DiscoverListItem";
import { cn } from "@/lib/cn";
import { useDiscoverPosition } from "../useDiscoverPosition";
import "../discover.css";

const itemKey = (item: ContentSummary) => `${item.objectType ?? ""}:${item.id}`;

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get("topic") ?? "";
  const rawType = searchParams.get("type");
  const type: DiscoverInput["type"] = rawType === "ARTICLE" || rawType === "SERIES" ? rawType : undefined;
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicsError, setTopicsError] = useState(false);
  const [items, setItems] = useState<ContentSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Only one row may be open at a time; the list reads as a single reading surface.
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const { rowRefs, preparePosition } = useDiscoverPosition(expandedKey);

  useEffect(() => {
    let active = true;
    topicsApi.getTopics().then((data) => {
      if (active) setTopics(data);
    }).catch(() => {
      if (active) setTopicsError(true);
    });
    return () => { active = false; };
  }, []);

  const changeFilter = (key: "topic" | "type", value: string) => {
    const current = key === "topic" ? topic : type ?? "";
    if (current === value) return;
    // Invalidate pending pagination immediately, before the next effect runs.
    requestVersion.current += 1;
    setLoading(true);
    setItems([]);
    setExpandedKey(null);
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

  const loadMore = useCallback(async () => {
    if (loadingMore || !nextCursor) return;
    const version = requestVersion.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const page = await discoverApi.getDiscover({
        limit: 20, cursor: nextCursor, ...(topic ? { topic } : {}), ...(type ? { type } : {}),
      });
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
  }, [loadingMore, nextCursor, topic, type]);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(false);
    setItems([]);
    setExpandedKey(null);
    setNextCursor(null);
    setLoadingMore(false);
    setLoadMoreError(null);
    discoverApi.getDiscover({ limit: 20, ...(topic ? { topic } : {}), ...(type ? { type } : {}) })
      .then((page) => {
        if (!active || version !== requestVersion.current) return;
        setItems(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
        setLoading(false);
      }).catch(() => {
        if (!active || version !== requestVersion.current) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [reloadKey, topic, type]);

  const isFiltered = Boolean(topic || type);

  return (
    <div className="section-gap">
      <PageMasthead variant="featured" title="探索发现" description="优质内容，每天更新" />
      <div className="discover-layout grid gap-6" data-focused={expandedKey !== null}>
        <DiscoverSidebar
          focused={expandedKey !== null}
          activeTopic={topic}
          onTopicChange={(value) => changeFilter("topic", value)}
          contentType={type ?? "ALL"}
          onContentTypeChange={(value) => changeFilter("type", value === "ALL" ? "" : value)}
          topics={topics}
          topicsError={topicsError}
        />
        <div className="min-w-0" aria-label="探索内容" aria-busy={loading || loadingMore}>
          {loading && <PageState kind="loading" />}
          {!loading && error && (
            <div className="section-gap-tight">
              <PageState kind="error" />
              <div className="text-center">
                <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>重新加载</Button>
              </div>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="section-gap-tight">
              <PageState
                kind="empty"
                title={isFiltered ? "暂无符合筛选条件的内容" : "社区还在生长中"}
                description={isFiltered ? "试试其他话题或内容类型。" : "还没有内容可以浏览。成为第一个分享的人吧。"}
              />
              {!isFiltered && <p className="text-center"><Link to="/studio" className={cn(buttonVariants({ variant: "outline" }), "text-sm")}>去创作</Link></p>}
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="rounded-2xl border border-border/80 bg-card shadow-sm">
              <ul className="flex flex-col divide-y divide-border/40">
                {items.map((item) => {
                  const key = itemKey(item);
                  return (
                    <li
                      key={key}
                      className="scroll-mt-24"
                      ref={(node) => {
                        if (node) rowRefs.current.set(key, node);
                        else rowRefs.current.delete(key);
                      }}
                    >
                      <DiscoverListItem
                        item={item}
                        variant={expandedKey === key ? "expanded" : expandedKey ? "compact" : "normal"}
                        onToggleExpand={() => {
                          const intent = expandedKey === key ? "close" : expandedKey ? "switch" : "open";
                          preparePosition(key, intent);
                          setExpandedKey((current) => (current === key ? null : key));
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!loading && !error && loadMoreError && <p role="alert" className="pt-2 text-center text-sm text-destructive">{loadMoreError}</p>}
          {!loading && !error && nextCursor && (
            <div className="mt-8 text-center">
              <Button variant="outline" size="lg" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "正在加载…" : "加载更多"}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
