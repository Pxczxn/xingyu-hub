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
 */

export type HomeFeedTab = "recommend" | "following";

const TABS: { id: HomeFeedTab; label: string }[] = [
  { id: "recommend", label: "推荐" },
  { id: "following", label: "关注" },
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
      className={cn("flex items-center gap-1 border-b border-border", className)}
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
  );
}
