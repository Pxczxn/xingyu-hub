import { Link } from "react-router-dom";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * 热门话题 — sidebar module.
 *
 * "热门" is derived client-side from `contentCount` (the only popularity signal
 * GET /api/v1/topics returns); no extra request and no invented metric. Rows with
 * a missing count sort last rather than being dropped.
 *
 * Like 社区公告 it hides entirely when empty — see AnnouncementPanel for why the
 * home-specific empty rule lives here instead of inside SectionState.
 */

const TOPIC_LIMIT = 5;

export function TrendingTopicsPanel({
  status,
  items,
}: {
  status: SectionStatus;
  items: TopicSummary[];
}) {
  if (status === "empty") return null;

  const ranked = [...items]
    .sort((a, b) => (b.contentCount ?? 0) - (a.contentCount ?? 0))
    .slice(0, TOPIC_LIMIT);

  return (
    <section
      aria-labelledby="home-trending-topics"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="home-trending-topics" className="text-sm font-semibold text-primary">
          热门话题
        </h2>
        <Link to="/topics" className="shrink-0 text-xs text-accent hover:underline">
          全部 ›
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无话题" className="border-0 bg-transparent p-0">
        <ul className="flex flex-col gap-1">
          {ranked.map((topic) => (
            <li key={topic.id}>
              <Link
                to={`/topics/${encodeURIComponent(topic.slug)}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span className="truncate font-medium text-foreground">{topic.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {topic.contentCount ?? 0} 内容
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </SectionState>
    </section>
  );
}
