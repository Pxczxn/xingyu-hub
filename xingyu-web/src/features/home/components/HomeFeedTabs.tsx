import { cn } from "@/lib/cn";
import { underlineTabClassName, underlineTabListClassName } from "@/components/ui/underline-tabs";

/*
 * 首页内容流的顶部一行：关注 / 推荐。
 *
 * 两个 tab 是真实数据源切换：
 *   推荐 -> MeHomeView.recommendations | GuestHomeView.discoveries
 *   关注 -> MeHomeView.followUpdates   | GuestHomeView.followingUpdates
 *
 * 外观与星系页共用下划线 Tab（`underlineTabClassName`）。发现分类用胶囊。
 */

export type HomeFeedTab = "recommend" | "following";

const TABS: { id: HomeFeedTab; label: string }[] = [
  { id: "following", label: "关注" },
  { id: "recommend", label: "推荐" },
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
    <div
      role="tablist"
      aria-label="首页内容流"
      className={cn(underlineTabListClassName, className)}
    >
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`home-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`home-tabpanel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn("focus-ring", underlineTabClassName(selected))}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
