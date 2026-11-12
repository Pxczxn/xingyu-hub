import { Heart, Star } from "lucide-react";
import { cn } from "@/lib/cn";

/*
 * 首页内容流的顶部一行：推荐 / 关注。
 *
 * 两个 tab 是真实数据源切换：
 *   推荐 -> MeHomeView.recommendations | GuestHomeView.discoveries
 *   关注 -> MeHomeView.followUpdates   | GuestHomeView.followingUpdates
 */

export type HomeFeedTab = "recommend" | "following";

const TABS: { id: HomeFeedTab; label: string; icon: typeof Star }[] = [
  { id: "recommend", label: "推荐", icon: Star },
  { id: "following", label: "关注", icon: Heart },
];

export function HomeFeedTabs({
  value,
  onChange,
  className,
}: {
  value: HomeFeedTab;
  onChange: (tab: HomeFeedTab) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center", className)}>
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
    </div>
  );
}
