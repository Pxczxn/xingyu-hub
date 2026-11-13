import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  { id: "ALL", label: "全部内容" },
  { id: "ARTICLE", label: "文章" },
  { id: "SERIES", label: "系列" },
  { id: "MOMENT", label: "动态" },
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
  const [topicSearch, setTopicSearch] = useState("");

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topics;
    const searchLower = topicSearch.toLowerCase();
    return topics.filter(
      (topic) =>
        topic.name.toLowerCase().includes(searchLower) ||
        topic.slug.toLowerCase().includes(searchLower),
    );
  }, [topics, topicSearch]);

  const sortClass = (active: boolean) =>
    cn(
      "rounded-full px-4 py-1.5 text-sm transition-colors focus-ring",
      active ? "bg-blue-50 font-medium text-blue-600" : "text-slate-600 hover:text-slate-900",
    );

  const topicClass = (active: boolean) =>
    cn(
      "relative flex w-full items-center justify-between gap-3 py-1.5 pl-3 pr-0.5 text-left text-sm transition-colors focus-ring",
      active
        ? "font-medium text-blue-600 before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-blue-600"
        : "text-slate-600 hover:text-slate-900",
    );

  return (
    <aside
      className={cn(
        "min-w-0 overflow-visible",
        "md:sticky md:top-[calc(var(--shell-header-height)+1rem)] md:self-start",
        className,
      )}
      aria-label="探索筛选"
    >
      <section aria-labelledby="discover-sort">
        <h2 id="discover-sort" className="text-sm font-semibold text-slate-900">
          排序
        </h2>
        <div role="radiogroup" aria-label="排序" className="mt-3 flex flex-wrap gap-1">
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
              className={sortClass(sort === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="discover-topic-filter" className="mt-6">
        <h2 id="discover-topic-filter" className="text-sm font-semibold text-slate-900">
          话题筛选
        </h2>

        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="text"
            value={topicSearch}
            onChange={(event) => setTopicSearch(event.target.value)}
            placeholder="搜索话题"
            aria-label="搜索话题"
            className="h-9 w-full rounded-lg border-0 bg-slate-100 pl-9 pr-9 text-sm text-slate-900 outline-none ring-blue-200 placeholder:text-slate-400 focus-visible:ring-2"
          />
          {topicSearch ? (
            <button
              type="button"
              onClick={() => setTopicSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-700"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <ul className="mt-3 flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => onTopicChange("")}
              aria-pressed={!activeTopic}
              className={topicClass(!activeTopic)}
            >
              全部话题
            </button>
          </li>
          {filteredTopics.map((topic) => (
            <li key={topic.id}>
              <button
                type="button"
                onClick={() => onTopicChange(topic.slug)}
                aria-pressed={activeTopic === topic.slug}
                className={topicClass(activeTopic === topic.slug)}
              >
                <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                {topic.contentCount !== undefined ? (
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {topic.contentCount}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {filteredTopics.length === 0 ? (
            <li className="py-4 text-sm text-slate-500">未找到匹配的话题</li>
          ) : null}
        </ul>
        {topicsError ? (
          <p role="status" className="mt-2 text-xs text-slate-500">
            话题暂时无法加载。
          </p>
        ) : null}
      </section>

      <section aria-labelledby="discover-type-filter" className="mt-6">
        <h2 id="discover-type-filter" className="text-sm font-semibold text-slate-900">
          内容类型
        </h2>
        <ul className="mt-3 flex flex-col">
          {CONTENT_TYPES.map(({ id, label }) => {
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
                    topicClass(contentType === id),
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
        {activeTopic ? (
          <p data-testid="discover-topic-type-hint" className="mt-2 text-xs leading-5 text-slate-500">
            话题只归类文章，选中话题时动态与系列不可筛选。
          </p>
        ) : null}
      </section>
    </aside>
  );
}
