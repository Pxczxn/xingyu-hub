import type { TopicSummary } from "@/api/topics/topics.types";
import { TopicCard } from "./TopicCard";

export function FeaturedTopics({ topics }: { topics: TopicSummary[] }) {
  if (topics.length === 0) return null;

  return (
    <section aria-labelledby="featured-topics">
      <h2 id="featured-topics" className="mb-3 text-base font-semibold tracking-tight text-primary">
        热门领域入口
      </h2>
      <ul className="grid grid-cols-6 gap-3" data-testid="featured-topics">
        {topics.map((topic) => (
          <TopicCard key={topic.id} topic={topic} featured />
        ))}
      </ul>
    </section>
  );
}
