import { Hash, BookOpen, Users, LayoutList, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DiscoverInput } from "@/api/discover/discover.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { cn } from "@/lib/cn";

type ContentType = NonNullable<DiscoverInput["type"]> | "ALL";

interface DiscoverSidebarProps {
  activeTopic: string;
  onTopicChange: (topic: string) => void;
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  topics: TopicSummary[];
  topicsError?: boolean;
  focused?: boolean;
  className?: string;
}

const CONTENT_TYPES = [
  { id: "ALL", label: "全部内容", icon: LayoutList },
  { id: "ARTICLE", label: "文章", icon: BookOpen },
  { id: "SERIES", label: "系列", icon: Users },
] as const;

/*
 * 视觉稿里话题是一长列，默认只露若干行，其余折在「展开其余话题」下面，否则
 * 「内容类型」整组会被挤出首屏。
 *
 * 折叠只裁可见区域，不裁 DOM：话题列表必须完整渲染 —— 每个话题都是一个真实
 * 筛选入口，数量多少与内容计数无关，这是既有契约（discover-filters.test.tsx
 * 用 10 个话题断言每个都能点）。被裁掉的那几行同时退出 Tab 序，键盘用户不会
 * 落在看不见的按钮上，展开后自动恢复。
 *
 * 选中项落在折叠区时要自动展开：否则筛选状态在侧栏里没有可见的落点。
 */
const COLLAPSED_TOPIC_COUNT = 6;
const OPTION_ROW_HEIGHT = 36;
const OPTION_GAP = 2;

export function DiscoverSidebar({
  activeTopic,
  onTopicChange,
  contentType,
  onContentTypeChange,
  topics,
  topicsError,
  focused = false,
  className,
}: DiscoverSidebarProps) {
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const activeIndex = topics.findIndex((topic) => topic.slug === activeTopic);
  const activeIsCollapsed = activeIndex >= COLLAPSED_TOPIC_COUNT;
  const showAll = topicsExpanded || activeIsCollapsed;
  const hasMore = topics.length > COLLAPSED_TOPIC_COUNT;
  // 「全部话题」占第一行，其后才是折叠区里的 6 行。
  const visibleRows = COLLAPSED_TOPIC_COUNT + 1;
  const collapsedHeight = visibleRows * OPTION_ROW_HEIGHT + (visibleRows - 1) * OPTION_GAP;

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
        "flex h-fit min-w-0 flex-col lg:sticky lg:top-20 lg:border-r lg:border-border/70 lg:pr-7",
        className,
      )}
      aria-label="探索筛选"
    >
      <p className="mb-5 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.16em] text-accent-strong/85">
        筛选
        <span aria-hidden className="h-px flex-1 bg-border/80" />
      </p>

      <section aria-labelledby="discover-topic-filter" className="mb-5">
        <h2
          id="discover-topic-filter"
          className="mb-3 flex items-baseline justify-between gap-2 text-sm font-bold text-foreground"
        >
          按话题筛选
          {!focused && (
            <span className="shrink-0 text-[11px] font-normal text-muted-foreground">
              可同时选择内容类型
            </span>
          )}
        </h2>
        <div
          className="overflow-hidden"
          style={hasMore && !showAll ? { maxHeight: collapsedHeight } : undefined}
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
            {topics.map((topic, index) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => onTopicChange(topic.slug)}
                  aria-pressed={activeTopic === topic.slug}
                  tabIndex={!showAll && index >= COLLAPSED_TOPIC_COUNT ? -1 : undefined}
                  className={optionClass(activeTopic === topic.slug)}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                  {topic.contentCount !== undefined && !focused && (
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
                      {topic.contentCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setTopicsExpanded((value) => !value)}
            aria-expanded={showAll}
            className="focus-ring mt-1.5 flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-accent-strong/85 transition-colors hover:text-accent-strong"
          >
            {showAll ? "收起话题" : "展开其余话题"}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showAll && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
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
          {CONTENT_TYPES.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => onContentTypeChange(id)}
                aria-pressed={contentType === id}
                className={optionClass(contentType === id)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
