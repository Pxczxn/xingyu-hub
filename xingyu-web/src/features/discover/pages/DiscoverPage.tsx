import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/api/client";
import { discoverApi } from "@/api/discover/discover.api";
import type { DiscoverInput } from "@/api/discover/discover.types";
import type { ContentSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { topicsApi } from "@/api/topics/topics.api";
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
  const type: DiscoverInput["type"] =
    rawType === "ARTICLE" || rawType === "SERIES" ? rawType : undefined;
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

  const changeFilter = (key: "topic" | "type", value: string) => {
    const current = key === "topic" ? topic : (type ?? "");
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
        limit: 20,
        cursor: nextCursor,
        ...(topic ? { topic } : {}),
        ...(type ? { type } : {}),
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
    discoverApi
      .getDiscover({ limit: 20, ...(topic ? { topic } : {}), ...(type ? { type } : {}) })
      .then((page) => {
        if (!active || version !== requestVersion.current) return;
        setItems(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
        setLoading(false);
      })
      .catch(() => {
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
    <div>
      {/*
       * 报头按视觉稿重排：eyebrow / 大标题 / 一句说明，右侧一句金句对齐基线，
       * 整条报头以一条细线收口 —— 与首页报头同一套排版语言，但字号与留白按
       * 探索页自己的稿子（标题 39px、上下 39/27px）。不再复用 PageMasthead：
       * 那个组件是「标题 + 操作按钮」的横向条，装不下右侧金句与底部通栏细线。
       */}
      <header className="border-b border-border/60">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 py-8 pb-6 sm:py-9 sm:pb-7">
          <div className="min-w-0">
            <p className="eyebrow">DISCOVER · 阅读发现</p>
            <h1 className="font-display mt-2 text-[2.05rem] font-extrabold leading-[1.22] tracking-[-0.045em] text-primary sm:text-[2.4375rem]">
              探索
            </h1>
            <p className="mt-2.5 text-sm text-muted-foreground">
              从感兴趣的话题，找到下一篇想读的内容。
            </p>
          </div>
          <p className="mb-1 hidden items-center gap-2 text-xs text-muted-foreground/75 sm:flex">
            <span aria-hidden className="text-lg leading-none text-accent-line">
              ✦
            </span>
            好内容，值得慢慢发现
          </p>
        </div>
      </header>
      <div className="discover-layout mt-7 grid gap-6" data-focused={expandedKey !== null}>
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
                <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
                  重新加载
                </Button>
              </div>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
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
                    className={cn(buttonVariants({ variant: "outline" }), "text-sm")}
                  >
                    去创作
                  </Link>
                </p>
              )}
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-4 border-b border-border/70 pb-3">
                <h2 className="text-[1.0625rem] font-bold tracking-[-0.01em] text-foreground">
                  发现内容
                </h2>
                <p className="hidden text-xs text-muted-foreground sm:block">
                  点击内容可<span className="px-0.5 text-accent-strong">展开阅读预览</span> ·
                  或直接阅读全文
                </p>
              </div>
              <ul>
                {items.map((item) => {
                  const key = itemKey(item);
                  return (
                    <li
                      key={key}
                      className="scroll-mt-24 border-b border-border/50 last:border-b-0"
                      ref={(node) => {
                        if (node) rowRefs.current.set(key, node);
                        else rowRefs.current.delete(key);
                      }}
                    >
                      <DiscoverListItem
                        item={item}
                        variant={
                          expandedKey === key ? "expanded" : expandedKey ? "compact" : "normal"
                        }
                        onToggleExpand={() => {
                          const intent =
                            expandedKey === key ? "close" : expandedKey ? "switch" : "open";
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
          {!loading && !error && loadMoreError && (
            <p role="alert" className="pt-2 text-right text-sm text-destructive">
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
    </div>
  );
}
