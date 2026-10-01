import { Link } from "react-router-dom";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { cn } from "@/lib/cn";
import type { TopicSummary } from "@/api/topics/topics.types";

/*
 * 热门话题 — sidebar module.
 *
 * "热门" is derived client-side from `contentCount` (the only popularity signal
 * GET /api/v1/topics returns); no extra request and no invented metric. Rows with
 * a missing count sort last rather than being dropped.
 *
 * The label next to the count is 「内容」, NOT 「讨论」. `contentCount` is
 * `countPublicContent` — published articles filed under the topic — and calling
 * that "discussions" would misdescribe the number by a wide margin.
 *
 * Like 社区公告 it hides entirely when empty — see AnnouncementPanel for why the
 * home-specific empty rule lives here instead of inside SectionState.
 */

const TOPIC_LIMIT = 5;

/** 「2.3k」 for thousands, plain digits below that. Keeps the rail from jittering. */
function formatCompact(value: number): string {
  if (value < 1000) return String(value);
  const thousands = value / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : thousands.toFixed(1)}k`;
}

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
      className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-none"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="home-trending-topics" className="text-sm font-semibold text-primary">
          热门话题
        </h2>
        <Link to="/topics" className="shrink-0 text-xs text-accent hover:underline">
          全部 ›
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无话题" className="border-0 bg-transparent p-0">
        <ol className="flex flex-col gap-0.5">
          {ranked.map((topic, index) => (
            <li key={topic.id}>
              <Link
                to={`/topics/${encodeURIComponent(topic.slug)}`}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/70"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-semibold tabular-nums",
                    index < 3
                      ? "bg-accent/15 text-accent-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {topic.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatCompact(topic.contentCount ?? 0)} 内容
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionState>
    </section>
  );
}
