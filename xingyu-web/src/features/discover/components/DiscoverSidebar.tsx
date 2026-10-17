import { Hash, BookOpen, Users, LayoutList } from "lucide-react";
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
  const filterClass = (active: boolean) => cn(
    "flex min-h-11 min-w-0 w-full items-center rounded-lg py-2 text-left text-sm transition-colors focus-ring",
    focused ? "gap-2 px-2" : "gap-2.5 px-3",
    active ? "bg-accent/15 font-medium text-accent-strong" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );

  return (
    <aside className={cn("flex h-fit min-w-0 flex-col gap-6 lg:sticky lg:top-20", className)} aria-label="探索筛选">
      <section aria-labelledby="discover-topic-filter">
        <h2 id="discover-topic-filter" className="mb-3 text-sm font-semibold text-foreground">按话题筛选</h2>
        <ul className="grid grid-cols-2 gap-1 lg:flex lg:flex-col">
          <li>
            <button type="button" onClick={() => onTopicChange("")} aria-pressed={!activeTopic} className={filterClass(!activeTopic)}>
              <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />全部话题
            </button>
          </li>
          {topics.map((topic) => (
            <li key={topic.id}>
              <button type="button" onClick={() => onTopicChange(topic.slug)} aria-pressed={activeTopic === topic.slug} className={filterClass(activeTopic === topic.slug)}>
                <Hash className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                {topic.contentCount !== undefined && !focused && <span className="shrink-0 text-xs tabular-nums">{topic.contentCount}</span>}
              </button>
            </li>
          ))}
        </ul>
        {topicsError && <p role="status" className="mt-2 text-xs text-muted-foreground">话题暂时无法加载。</p>}
      </section>
      <section aria-labelledby="discover-type-filter">
        <h2 id="discover-type-filter" className="mb-3 text-sm font-semibold text-foreground">内容类型</h2>
        <ul className="flex gap-1 lg:flex-col">
          {CONTENT_TYPES.map(({ id, label, icon: Icon }) => (
            <li key={id} className="flex-1">
              <button type="button" onClick={() => onContentTypeChange(id)} aria-pressed={contentType === id} className={filterClass(contentType === id)}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />{label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
