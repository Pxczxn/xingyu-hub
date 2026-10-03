import { Link } from "react-router-dom";
import type { SectionStatus } from "@/components/shared/SectionState";
import type { TopicSummary } from "@/api/topics/topics.types";

const TOPIC_LIMIT = 6;

export function ExploreTopics({
  status,
  topics,
}: {
  status: SectionStatus;
  topics: TopicSummary[];
}) {
  if (status === "empty" || status === "loading") return null;

  if (status === "error") {
    return (
      <section aria-labelledby="discover-topics" className="rounded-xl border border-border/70 bg-card/70 p-4">
        <h2 id="discover-topics" className="text-base font-semibold text-primary">探索话题</h2>
        <p className="mt-1 text-sm text-muted-foreground">探索方向暂时无法加载。</p>
      </section>
    );
  }

  const visibleTopics = topics.filter((topic) => (topic.contentCount ?? 0) > 0).slice(0, TOPIC_LIMIT);
  if (visibleTopics.length === 0) return null;

  return (
    <section aria-labelledby="discover-topics">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="discover-topics" className="text-lg font-semibold tracking-tight text-primary">探索话题</h2>
        </div>
        {topics.filter((topic) => (topic.contentCount ?? 0) > 0).length > TOPIC_LIMIT ? (
          <Link to="/topics" className="shrink-0 text-sm text-accent hover:underline">查看全部话题 ›</Link>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-3" data-testid="discover-topics-list">
        {visibleTopics.map((topic) => (
          <li key={topic.id}>
            <Link
              to={`/topics/${encodeURIComponent(topic.slug)}`}
              className="group flex min-w-[150px] items-center gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 transition-colors hover:border-accent/60 hover:bg-accent/5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary group-hover:text-accent">
                {topic.name}
              </span>
              {topic.contentCount !== undefined ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
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
