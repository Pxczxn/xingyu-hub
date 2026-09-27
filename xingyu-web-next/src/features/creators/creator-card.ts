/*
 * CreatorCard — the aggregated shape behind /creators.
 *
 * A "creator" is NOT a backend entity. `/creators` is a pure front-end
 * aggregation page (Legacy did the same): it fans out to
 *   GET /topics                       → pick the first N topics
 *   GET /topics/{slug}/creators       → creators per topic
 *   GET /users/{username}             → profile (avatar / displayName / following)
 *   GET /users/{username}/works       → latest public work
 * and merges the results client-side.
 *
 * Consequences the UI must be honest about:
 *   - There is no server-side search or topic filter for creators. The filter
 *     chips only narrow the N topics we actually fanned out to, so the page says
 *     so instead of pretending to search the whole community.
 *   - `topics` accumulates the topic names this username appeared under; a
 *     creator found in two topics appears once.
 *   - `contentCount` is the MAX across topics, not a sum — the per-topic count
 *     is the creator's total published content, so summing would double count.
 *   - profile / works are decorative: when either fetch fails the card still
 *     renders from the topic row alone.
 */
import type { TopicCreatorSummary, TopicSummary } from "@/api/topics/topics.types";
import type { ProfileDetail, SpaceWorkItem } from "@/api/users/users.types";

export type CreatorCard = TopicCreatorSummary & {
  profile: ProfileDetail | null;
  /** Latest public work, or null when the creator has none. */
  latestWork: SpaceWorkItem | null;
  /** Topic names this creator was found under (deduplicated, in discovery order). */
  topics: string[];
};

/** How many topics we fan out to. Legacy used 8; the cost is 1 + N + up-to-2*M requests. */
export const CREATOR_TOPIC_LIMIT = 8;

/** Per-topic creator page size. */
export const CREATOR_PER_TOPIC_LIMIT = 8;

/** How many creator cards are enriched with profile + works (the expensive part). */
export const CREATOR_CARD_LIMIT = 12;

/** Display name with the same fallback order Legacy used. */
export function creatorDisplayName(creator: CreatorCard): string {
  return creator.profile?.displayName || creator.displayName || creator.username;
}

/** Avatar initial — uppercase first character, used when there is no avatar URL. */
export function creatorInitial(creator: CreatorCard): string {
  return creatorDisplayName(creator).slice(0, 1).toUpperCase();
}

/**
 * Merge per-topic creator rows into deduplicated cards.
 *
 * Kept pure and exported so the dedup + max-count rules are directly testable
 * without rendering the page.
 */
export function mergeCreatorRows(
  rows: Array<{ topic: TopicSummary; creators: TopicCreatorSummary[] }>
): Array<TopicCreatorSummary & { topics: string[] }> {
  const grouped = new Map<string, TopicCreatorSummary & { topics: string[] }>();
  for (const { topic, creators } of rows) {
    for (const creator of creators) {
      const existing = grouped.get(creator.username);
      if (existing) {
        // MAX, not sum: contentCount is the creator's total, not a per-topic count.
        existing.contentCount = Math.max(existing.contentCount, creator.contentCount);
        if (!existing.topics.includes(topic.name)) {
          existing.topics.push(topic.name);
        }
        // Prefer a non-empty displayName if a later topic row has one.
        if (!existing.displayName && creator.displayName) {
          existing.displayName = creator.displayName;
        }
      } else {
        grouped.set(creator.username, { ...creator, topics: [topic.name] });
      }
    }
  }
  return [...grouped.values()];
}

/**
 * Apply the client-side topic filter + keyword search.
 *
 * `activeTopic` is compared against the topic NAMES each creator was found
 * under, and the keyword matches displayName / username / topic names — the same
 * fields Legacy searched. There is no backend search behind this.
 */
export function filterCreators(
  creators: CreatorCard[],
  activeTopic: string,
  query: string
): CreatorCard[] {
  const needle = query.trim().toLowerCase();
  return creators.filter((creator) => {
    if (activeTopic !== "ALL" && !creator.topics.includes(activeTopic)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    const haystack = `${creator.displayName ?? ""} ${creator.username} ${creator.topics.join(" ")}`;
    return haystack.toLowerCase().includes(needle);
  });
}
