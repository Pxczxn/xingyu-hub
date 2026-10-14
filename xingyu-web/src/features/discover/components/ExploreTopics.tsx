import { Link } from "react-router-dom";
import type { SectionStatus } from "@/components/shared/SectionState";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * 探索话题 — the discover page's exit row (P2).
 *
 * 2026-10-13 (layout batch 02): demoted from a bordered card block to a chip row,
 * and moved from above the feed to below it.
 *
 * The old shape was a grid of `min-w-[150px]` bordered cards with `px-4 py-3`
 * padding — the same surface treatment as the content itself. Sitting ABOVE the
 * feed, that made a navigation block the first thing a reader met on a page whose
 * purpose is browsing, and it was styled as though it were content. Two changes
 * fix both halves:
 *
 *   1. Position. It is now the last thing on the page. A reader who has scrolled
 *      past the feed's own 「加载更多」 has signalled they are done browsing, and
 *      that is the moment a way out is useful.
 *   2. Weight. Chips instead of cards: no fill, no shadow, `rounded-full` and
 *      `px-3 py-1.5`. The border-only pill is the vocabulary this codebase already
 *      uses for a non-content token (see MySubmissionsPage / SubmissionDetailPage),
 *      so this reads as a label you can follow rather than as one more content
 *      card. The heading drops from `text-lg` to `text-sm` for the same reason —
 *      it must not compete with 「发现内容」/「更多内容」, which ARE sections of the feed.
 *
 * The count stays VISIBLE rather than being folded into an `aria-label`. It is the
 * one signal that separates a topic worth opening from an empty one, and the chips
 * filter `contentCount > 0` for exactly that reason — so the number is the point,
 * not decoration.
 */

const TOPIC_LIMIT = 6;

export function ExploreTopics({
  status,
  topics,
}: {
  status: SectionStatus;
  topics: TopicSummary[];
}) {
  // Nothing to offer, and nothing to apologise for: a P2 row that has no data
  // should be absent, not present-and-empty.
  if (status === "empty" || status === "loading") return null;

  if (status === "error") {
    /*
     * Deliberately NOT a bordered box any more. This is the failure of a secondary
     * exit row — the feed above it is unaffected — so it states the fact in one line
     * instead of drawing a surface that would out-weigh the chips it replaces.
     * The copy is unchanged.
     */
    return (
      <section aria-labelledby="discover-topics">
        <h2 id="discover-topics" className="text-sm font-semibold text-primary">
          探索话题
        </h2>
        <p className="mt-2 text-meta text-muted-foreground">探索方向暂时无法加载。</p>
      </section>
    );
  }

  const nonEmpty = topics.filter((topic) => (topic.contentCount ?? 0) > 0);
  const visibleTopics = nonEmpty.slice(0, TOPIC_LIMIT);
  if (visibleTopics.length === 0) return null;

  return (
    <section aria-labelledby="discover-topics">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="discover-topics" className="text-sm font-semibold text-primary">
          探索话题
        </h2>
        {nonEmpty.length > TOPIC_LIMIT ? (
          <Link to="/topics" className="shrink-0 text-meta text-accent-strong hover:underline">
            查看全部话题 ›
          </Link>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-2" data-testid="discover-topics-list">
        {visibleTopics.map((topic) => (
          <li key={topic.id}>
            {/*
             * `max-w-full` + `min-w-0 truncate` keep a pathologically long topic
             * name from overflowing the shell. The chip sizes to its content, so
             * truncation only engages when the name alone would exceed the column —
             * the old fixed `min-w-[150px]` track was what made truncation routine.
             */}
            <Link
              to={`/topics/${encodeURIComponent(topic.slug)}`}
              className="group inline-flex max-w-full items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-sm transition-colors hover:border-accent/60 hover:bg-accent/5"
            >
              <span className="min-w-0 truncate font-medium text-primary group-hover:text-accent-strong">
                {topic.name}
              </span>
              {topic.contentCount !== undefined ? (
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                  {topic.contentCount} 篇内容
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
