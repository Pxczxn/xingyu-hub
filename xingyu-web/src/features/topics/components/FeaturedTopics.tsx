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
       * Responsive columns. 2026-10-03: this shipped as a bare `grid-cols-6`, which
       * on a 390px phone gives each cell 44px — narrower than the card's own icon
       * plus its label, so the content pushed the page sideways and the whole
       * /topics page scrolled horizontally.
       *
       * Six columns is the right DENSITY for a wide screen (these are small entry
       * points, not content cards); it is the wrong one for a phone. Scale down to
       * 3, which still reads as a grid rather than a list.
       */}
      <ul
        className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6"
        data-testid="featured-topics"
      >
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} featured />
        ))}
      </ul>
    </section>
  );
}
