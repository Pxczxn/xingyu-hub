import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * 首页内容流的顶部一行：推荐 / 关注 + 话题入口。
 *
 * 两个 tab 是真实数据源切换：
 *   推荐 -> MeHomeView.recommendations | GuestHomeView.discoveries
 *   关注 -> MeHomeView.followUpdates   | GuestHomeView.followingUpdates
 *
 * 右侧每个话题都是真实话题（GET /api/v1/topics，按内容数排序），点击进入
 * 该话题的探索页，而不是在首页做一次假的本地过滤 —— 首页接口不接受话题参数，
 * 客户端过滤会得到「点了但列表没变」的假交互。没有话题数据时整段不渲染。
 *
 * `trailing` 是右端插槽，首页用来放「查看更多推荐」。
 */

export type HomeFeedTab = "recommend" | "following";

const TABS: { id: HomeFeedTab; label: string; icon: typeof Star }[] = [
  { id: "recommend", label: "推荐", icon: Star },
  { id: "following", label: "关注", icon: Heart },
];

const TOPIC_CHIP_LIMIT = 6;

export function HomeFeedTabs({
  value,
  onChange,
  topics = [],
  trailing,
  className,
}: {
  value: HomeFeedTab;
  onChange: (tab: HomeFeedTab) => void;
  /** 真实话题，用于话题入口；空数组则不渲染。 */
  topics?: TopicSummary[];
  /** Rendered at the far right of the row. */
  trailing?: ReactNode;
  className?: string;
}) {
  const chips = topics.slice(0, TOPIC_CHIP_LIMIT);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <div role="tablist" aria-label="首页内容流" className="flex shrink-0 items-center gap-1">
        {TABS.map((tab) => {
          const selected = tab.id === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`home-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`home-tabpanel-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                selected
                  ? "bg-accent-soft font-medium text-accent-strong"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", selected && "fill-current")} aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {chips.length > 0 ? (
        <>
          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-border sm:block" />
          <nav
            aria-label="按话题浏览"
            className="flex w-full min-w-0 items-center gap-1 overflow-x-auto sm:w-auto sm:flex-1"
          >
            <Link
              to="/discover"
              className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-foreground transition-colors hover:text-accent-strong"
            >
              全部
            </Link>
            {chips.map((topic) => (
              <Link
                key={topic.id}
                to={`/discover?topic=${encodeURIComponent(topic.slug)}`}
                className="shrink-0 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent-strong"
              >
                {topic.name}
              </Link>
            ))}
          </nav>
        </>
      ) : (
        <div className="flex-1" />
      )}

      {trailing ? (
        <div className="ml-auto shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
