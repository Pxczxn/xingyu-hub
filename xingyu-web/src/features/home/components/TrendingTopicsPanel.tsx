import { Link } from "react-router-dom";
import { Hash } from "lucide-react";
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
      className="rounded-2xl border border-border/60 bg-card/60 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="home-trending-topics"
          className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent-strong">
            <Hash className="h-3.5 w-3.5" aria-hidden />
          </span>
          热门话题
        </h2>
        <Link
          to="/topics"
          className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-accent-strong"
        >
          查看全部 →
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无话题" className="border-0 bg-transparent p-0">
        <ol className="flex flex-col gap-0.5">
          {ranked.map((topic, index) => (
            <li key={topic.id}>
              <Link
                to={`/topics/${encodeURIComponent(topic.slug)}`}
                className="-mx-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors hover:bg-accent-soft/60"
              >
                <span
                  aria-hidden
                  className={cn(
                    "w-4 shrink-0 text-center text-xs font-semibold tabular-nums",
                    index < 3 ? "text-accent-strong" : "text-muted-foreground/60",
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                  {topic.name}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatCompact(topic.contentCount ?? 0)} 篇
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionState>
    </section>
  );
}
