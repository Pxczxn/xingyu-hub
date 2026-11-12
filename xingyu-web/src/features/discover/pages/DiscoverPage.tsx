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
import { PageHero } from "@/components/shared/PageHero";
import { ArchetypeFrame, BleedBand } from "@/components/layout";
import { DiscoverSidebar } from "@/features/discover/components/DiscoverSidebar";
import { DiscoverListItem } from "@/features/discover/components/DiscoverListItem";
import { DiscoverReadingSheet } from "@/features/discover/components/DiscoverReadingSheet";
import { cn } from "@/lib/cn";
import "../discover.css";

const itemKey = (item: ContentSummary) => `${item.objectType ?? ""}:${item.id}`;

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
  const sort: DiscoverSort =
    rawSort === "featured" || rawSort === "interest" ? rawSort : "latest";
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
        if (err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")) {
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

  /*
   * SK2 画廊 · H 幅 / D 松 / R 出（A §3 的 Discover 行）。
   *
   *   skeleton="SK2"    → 画廊原型：无卡面的发现带 + 等权文本行，页面不再手写
   *                       `text-[2.05rem]` 这类标题，也没有 `mt-7` 手写间距。
   *   header="banner"   → H=幅：有面横幅 `PageHero`（卡片面 + eyebrow + 说明）。
   *   density="loose"   → D=松：首屏 ≤3 块、区块间距 40px。
   *   R=出             → 首屏就是一条整幅出血带：`BleedBand` 用与 shell 内边距
   *                       等量的负 margin 把底色推到内容列外缘，横幅坐在带里；
   *                       出血带全页只出现这一次，其后的筛选列与列表都回到内容列。
   *
   * 与同为 SK2·幅/松/出的 TopicsPage 的区别（两页四元组相同，必须靠构图区分）：
   *   本页的出血带里是**横幅**（标题 + 说明，orbit 母题，sunken 面）；带下面是
   *   「左侧筛选列 + 单列阅读行」，行可以就地点开读正文。
   *   Topics 的出血带里是**话题目录**（热门/最近活跃两份带真实计数的名单，mesh
   *   母题，card 面）；带下面是三列等权卡格。一个先给「你是谁」，一个先给「从哪
   *   开始」。
   *
   * 筛选列仍是 `DiscoverSidebar`（`features/discover/components`，不在本批写作用域）：
   * 它的 244px 固定宽与 `.discover-layout` 的断点列定义是一体的，所以两栏关系保留，
   * 页面只换了报头与区块节奏。
   */
  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="loose"
      headerSlot={
        <BleedBand tone="sunken" motif="orbit" contentClassName="px-4 py-9 md:px-6 md:py-11">
          <PageHero
            eyebrow="DISCOVER · 阅读发现"
            title="探索"
            description="从感兴趣的话题，找到下一篇想读的内容。"
          />
        </BleedBand>
      }
    >
      <div className="discover-layout grid gap-6">
        <DiscoverSidebar
          activeTopic={topic}
          onTopicChange={(value) => changeFilter("topic", value)}
          sort={sort}
          onSortChange={changeSort}
          contentType={type ?? "ALL"}
          onContentTypeChange={(value) => changeFilter("type", value === "ALL" ? "" : value)}
          topics={topics}
          topicsError={topicsError}
        />
        <div className="min-w-0" aria-label="探索内容" aria-busy={loading || loadingMore}>
          {loading && <PageState kind="loading" />}
          {!loading && needsLogin && (
            <div className="section-gap-tight">
              <PageState kind="empty" title="登录后查看兴趣相关" description="按你选择的探索方向筛选公开文章。" />
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
            <div>
              <div className="border-b border-border/70 pb-3">
                <h2 className="text-h3 text-primary">发现内容</h2>
              </div>
              <ul className="xl:grid xl:grid-cols-2 xl:gap-x-6">
                {items.map((item) => {
                  const key = itemKey(item);
                  return (
                    <li
                      key={key}
                      className="border-b border-border/50 last:border-b-0"
                    >
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
            </div>
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

      {/* Reading Sheet */}
      <DiscoverReadingSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedItem(null);
        }}
      />
    </ArchetypeFrame>
  );
}
