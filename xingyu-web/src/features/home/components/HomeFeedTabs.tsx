import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Home feed switcher — 推荐 / 关注
 *
 * 设计升级（2026-10-14）：
 *  - 从简单下划线 → 现代卡片式切换
 *  - 增加动效：悬浮、点击、切换
 *  - 增加视觉细节：背景、阴影、滑动指示器
 *
 * 两个 tab 对应真实数据：
 *   - 推荐 -> MeHomeView.recommendations   | GuestHomeView.discoveries
 *   - 关注 -> MeHomeView.followUpdates     | GuestHomeView.followingUpdates
 *
 * `trailing` 是右侧插槽，首页用来放"查看更多推荐"
 */

export type HomeFeedTab = "recommend" | "following";

const TABS: { id: HomeFeedTab; label: string }[] = [
  { id: "recommend", label: "推荐" },
  { id: "following", label: "关注" },
];

export function HomeFeedTabs({
  value,
  onChange,
  trailing,
  className,
}: {
  value: HomeFeedTab;
  onChange: (tab: HomeFeedTab) => void;
  /** Rendered at the far right of the tab row. */
  trailing?: ReactNode;
  className?: string;
}) {
  const selectedIndex = TABS.findIndex((tab) => tab.id === value);

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {/* Tab 列表 - 现代卡片式设计 */}
      <div
        role="tablist"
        aria-label="首页内容流"
        className="relative inline-flex items-center gap-1 rounded-lg bg-muted/50 p-1"
      >
        {/* 滑动背景指示器 */}
        <div
          className="absolute left-1 top-1 bottom-1 rounded-md bg-background shadow-sm transition-all duration-200 ease-out"
          style={{
            width: `calc(50% - 4px)`,
            transform: `translateX(${selectedIndex * 100}%)`,
          }}
          aria-hidden="true"
        />

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
              className={cn(
                "relative z-10 px-4 py-2 text-sm font-medium transition-all duration-200",
                "rounded-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                selected
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground active:scale-95",
              )}
            >
              {/* Tab 文字 */}
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 右侧插槽 - "查看更多推荐" */}
      {trailing ? (
        <div className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
