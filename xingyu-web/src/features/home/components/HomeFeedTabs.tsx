import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Home feed switcher.
 *
 * Two tabs only — 推荐 / 关注. Both are backed by real payload fields of the
 * home composition endpoint:
 *   - 推荐 -> MeHomeView.recommendations   | GuestHomeView.discoveries
 *   - 关注 -> MeHomeView.followUpdates     | GuestHomeView.followingUpdates
 *
 * 最新 is deliberately ABSENT. There is no chronological "latest content"
 * endpoint in this codebase (checked the whole `src/api` surface): /api/v1/discover
 * takes no sort parameter and /api/v1/search?sort=latest requires a keyword.
 * A third tab would therefore be a control that can never return data, so it is
 * not rendered at all rather than mocked.
 *
 * `trailing` is a slot on the right of the same row, used by the home page for
 * 查看更多. It is a slot rather than a hardcoded link because the correct target
 * depends on the active tab, and this component does not know which routes exist.
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
  return (
    <div className={cn("flex items-center justify-between gap-4 border-b border-border", className)}>
      <div role="tablist" aria-label="首页内容流" className="flex items-center gap-1">
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
                "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                selected
                  ? "border-accent text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="shrink-0 pb-1 text-xs">{trailing}</div> : null}
    </div>
  );
}
