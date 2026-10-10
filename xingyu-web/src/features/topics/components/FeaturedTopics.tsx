import type { TopicSummary } from "@/api/topics/topics.types";
import { TopicCard } from "./TopicCard";

export function FeaturedTopics({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="featured-topics">
      <h2 id="featured-topics" className="mb-3 text-base font-semibold tracking-tight text-primary">
        热门领域入口
      </h2>
      {/*
       * Responsive columns.
       *
       * 2026-10-03: this shipped as a bare `grid-cols-6`, which on a 390px phone gives
       * each cell 44px — narrower than the card's own icon plus its label, so the
       * content pushed the page sideways.
       *
       * 2026-10-04: that fix went to `grid-cols-3`, which DID stop the sideways scroll
       * but left the card unreadable. Measured at 390: a 101px cell minus `p-3.5` (28),
       * the 36px visual, `gap-3` (12) and the 16px arrow leaves ~9px for the text —
       * so the topic NAME vanished entirely and 「2 篇内容」 stacked one character per
       * line. 2 columns give ~157px and ~65px of text column, which fits the name and
       * the count on one line each.
       *
       * Two columns, not a different mobile card: same component, same icon, same
       * order — only the column count changes.
       */}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6" data-testid="featured-topics">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} featured />
        ))}
      </ul>
    </section>
  );
}
