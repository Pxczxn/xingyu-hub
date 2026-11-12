import { Hash, BookOpen, Users, LayoutList, MessageSquare, Search, X } from "lucide-react";
import { useRef, useCallback, useState, useMemo } from "react";
import type { DiscoverInput } from "@/api/discover/discover.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { cn } from "@/lib/cn";

type ContentType = NonNullable<DiscoverInput["type"]> | "ALL";

interface DiscoverSidebarProps {
  activeTopic: string;
  onTopicChange: (topic: string) => void;
  sort: "latest" | "featured" | "interest";
  onSortChange: (sort: "latest" | "featured" | "interest") => void;
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  topics: TopicSummary[];
  topicsError?: boolean;
  className?: string;
}

const CONTENT_TYPES = [
  { id: "ALL", label: "全部内容", icon: LayoutList },
  { id: "ARTICLE", label: "文章", icon: BookOpen },
  { id: "SERIES", label: "系列", icon: Users },
  { id: "MOMENT", label: "动态", icon: MessageSquare },
] as const;

export function DiscoverSidebar({
  activeTopic,
  onTopicChange,
  sort,
  onSortChange,
  contentType,
  onContentTypeChange,
  topics,
  topicsError,
  className,
}: DiscoverSidebarProps) {
  const topicsScrollRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");

  // 根据搜索词筛选话题
  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topics;
    const searchLower = topicSearch.toLowerCase();
    return topics.filter((topic) =>
      topic.name.toLowerCase().includes(searchLower) ||
      topic.slug.toLowerCase().includes(searchLower)
    );
  }, [topics, topicSearch]);

  // 处理话题列表的滚动事件，只在鼠标悬停且到达边界时才允许冒泡
  const handleTopicsWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 如果鼠标不在容器内，不拦截滚动
    if (!isHovering) return;

    const container = topicsScrollRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtTop = scrollTop === 0;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

    // 向上滚动且已到顶部，或向下滚动且已到底部，允许冒泡
    if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
      return;
    }

    // 否则阻止冒泡，只滚动话题列表
    e.stopPropagation();
  }, [isHovering]);

  const optionClass = (active: boolean) =>
    cn(
      "flex min-h-9 w-full items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-left text-sm transition-colors focus-ring",
      active
        ? "bg-accent-soft font-semibold text-accent-strong"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    );

  return (
    <aside
      className={cn(
        "flex h-fit min-w-0 flex-col",
        // Sticky 定位
        "lg:sticky lg:top-[calc(var(--shell-header-height)+1rem)]",
        // 最大高度和滚动
        "lg:max-h-[calc(100vh-var(--shell-header-height)-2rem)]",
        "lg:overflow-y-auto lg:overscroll-contain",
        "lg:border-r lg:border-border/70 lg:pr-7",
        className,
      )}
      aria-label="探索筛选"
    >
      <p className="mb-5 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.16em] text-accent-strong/85">
        筛选
        <span aria-hidden className="h-px flex-1 bg-border/80" />
      </p>

      <section aria-labelledby="discover-sort" className="mb-5">
        <h2 id="discover-sort" className="mb-3 text-sm font-bold text-foreground">
          排序
        </h2>
        <div role="radiogroup" aria-label="排序" className="flex gap-1">
          {(
            [
              ["latest", "最新"],
              ["featured", "精选"],
              ["interest", "兴趣"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={sort === value}
              onClick={() => onSortChange(value)}
              className={optionClass(sort === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <div aria-hidden className="mb-5 h-px bg-border/70" />

      <section aria-labelledby="discover-topic-filter" className="mb-5">
        <div className="mb-3">
          <h2
            id="discover-topic-filter"
            className="whitespace-nowrap text-sm font-bold text-foreground"
          >
            按话题筛选
          </h2>
        </div>

        {/* 话题搜索框 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={topicSearch}
            onChange={(e) => setTopicSearch(e.target.value)}
            placeholder="搜索话题..."
            className="focus-ring h-9 w-full rounded-lg border border-border/50 bg-background pl-9 pr-9 text-sm transition-colors placeholder:text-muted-foreground/60 hover:border-border focus:border-accent-strong"
          />
          {topicSearch && (
            <button
              type="button"
              onClick={() => setTopicSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 话题列表 - 固定高度 + 滚动 + 隐藏滚动条 + 智能滚动冒泡 */}
        <div
          ref={topicsScrollRef}
          onWheel={handleTopicsWheel}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="scrollbar-none max-h-[400px] overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-2"
        >
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                onClick={() => onTopicChange("")}
                aria-pressed={!activeTopic}
                className={optionClass(!activeTopic)}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                全部话题
              </button>
            </li>
            {filteredTopics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => onTopicChange(topic.slug)}
                  aria-pressed={activeTopic === topic.slug}
                  className={optionClass(activeTopic === topic.slug)}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                  {topic.contentCount !== undefined && (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
                      {topic.contentCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {filteredTopics.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                未找到匹配的话题
              </li>
            )}
          </ul>
        </div>
        {topicsError && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            话题暂时无法加载。
          </p>
        )}
      </section>

      <div aria-hidden className="mb-5 h-px bg-border/70" />

      <section aria-labelledby="discover-type-filter">
        <h2 id="discover-type-filter" className="mb-3 text-sm font-bold text-foreground">
          内容类型
        </h2>
        <ul className="flex flex-col gap-0.5">
          {CONTENT_TYPES.map(({ id, label, icon: Icon }) => {
            /*
             * 话题只挂在文章上（后端 `article_topic`），带 topic 时后端只会返回文章。
             * 让「动态 / 系列」在有话题时保持可用，就会得到一个空列表——用户读到的是
             * 「这个话题没有动态」，而事实是这两类内容没有话题维度。
             */
            const lockedByTopic = Boolean(activeTopic) && (id === "MOMENT" || id === "SERIES");
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onContentTypeChange(id)}
                  aria-pressed={contentType === id}
                  disabled={lockedByTopic}
                  title={
                    lockedByTopic ? "话题只归类文章，清空话题后才能筛选动态或系列。" : undefined
                  }
                  className={cn(
                    optionClass(contentType === id),
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
        {activeTopic ? (
          <p
            data-testid="discover-topic-type-hint"
            className="mt-2 text-xs leading-5 text-muted-foreground"
          >
            话题只归类文章，选中话题时动态与系列不可筛选。
          </p>
        ) : null}
      </section>
    </aside>
  );
}
