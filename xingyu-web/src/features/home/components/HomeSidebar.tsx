import type { SectionStatus } from "@/components/shared/SectionState";
import type { AnnouncementSummary } from "@/api/common.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { AnnouncementPanel } from "./AnnouncementPanel";
import { TrendingTopicsPanel } from "./TrendingTopicsPanel";

/*
 * Right-hand column of the home page (1/3 on desktop): 社区公告 + 热门话题.
 *
 * Both modules are non-critical. If neither has anything to show the whole
 * column is dropped, so an empty sidebar never leaves a tall blank rail next to
 * the feed.
 */

export type HomeSidebarSection<T> = { status: SectionStatus; items: T[] };

/**
 * Whether the rail will render anything at all. Exported so the page can size
 * the feed column (full width vs. 2/3) from the same rule the rail uses — the
 * two must never disagree, so there is one implementation, not two.
 */
export function hasSidebarContent(
  announcements: HomeSidebarSection<AnnouncementSummary>,
  topics: HomeSidebarSection<TopicSummary>,
): boolean {
  return announcements.status !== "empty" || topics.status !== "empty";
}

export function HomeSidebar({
  announcements,
  topics,
}: {
  announcements: HomeSidebarSection<AnnouncementSummary>;
  topics: HomeSidebarSection<TopicSummary>;
}) {
  if (!hasSidebarContent(announcements, topics)) return null;

  return (
    <aside aria-label="社区侧栏" className="flex flex-col gap-4">
      <AnnouncementPanel status={announcements.status} items={announcements.items} />
      <TrendingTopicsPanel status={topics.status} items={topics.items} />
    </aside>
  );
}
