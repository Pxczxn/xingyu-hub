import type { SectionStatus } from "@/components/shared/SectionState";
import type { EventView } from "@/api/events/events.types";
import type { TopicSummary } from "@/api/topics/topics.types";
import { TrendingTopicsPanel } from "./TrendingTopicsPanel";
import { RecommendedCreatorsPanel } from "./RecommendedCreatorsPanel";
import { CommunityEventsPanel } from "./CommunityEventsPanel";
import type { RecommendedCreator } from "../use-recommended-creators";

/*
 * Right-hand column of the home page (1/3 on desktop):
 *   热门话题 · 推荐创作者 · 社区活动
 *
 * Every module is non-critical and independent. Each one owns its own
 * loading / error / empty state, and the home-specific rule is "empty means
 * invisible": a module with nothing to show renders NOTHING rather than a
 * placeholder box, so an empty rail never leaves a tall blank column beside the
 * feed. A module whose request FAILED still renders (as an error box) — the two
 * cases are deliberately not merged, because "we could not load this" is
 * information and "there is nothing here" is not.
 *
 * `hasSidebarContent` is exported so the page can size the feed column (full
 * width vs. 2/3) from the SAME rule the rail uses. One implementation, so the
 * two can never disagree.
 */

export type HomeSidebarSection<T> = { status: SectionStatus; items: T[] };

export function hasSidebarContent(sections: HomeSidebarSection<unknown>[]): boolean {
  return sections.some((section) => section.status !== "empty");
}

export function HomeSidebar({
  topics,
  creators,
  events,
  signedIn,
  followError,
  pendingUsername,
  onToggleFollow,
}: {
  topics: HomeSidebarSection<TopicSummary>;
  creators: HomeSidebarSection<RecommendedCreator>;
  events: HomeSidebarSection<EventView>;
  signedIn: boolean;
  followError: string | null;
  pendingUsername: string | null;
  onToggleFollow: (creator: RecommendedCreator) => void;
}) {
  if (!hasSidebarContent([topics, creators, events])) return null;

  return (
    <aside aria-label="社区侧栏" className="flex flex-col gap-3">
      <TrendingTopicsPanel status={topics.status} items={topics.items} />
      <RecommendedCreatorsPanel
        status={creators.status}
        creators={creators.items}
        signedIn={signedIn}
        followError={followError}
        pendingUsername={pendingUsername}
        onToggleFollow={onToggleFollow}
      />
      <CommunityEventsPanel status={events.status} items={events.items} />
    </aside>
  );
}
