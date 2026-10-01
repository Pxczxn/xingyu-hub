import { Link } from "react-router-dom";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { formatMonthDay } from "@/lib/relative-time";
import type { AnnouncementSummary } from "@/api/common.types";

/*
 * 社区公告 — sidebar module.
 *
 * `SectionState` keeps its generic behaviour (loading / error / empty), so this
 * panel inherits it unchanged. The only home-specific decision is the empty
 * case: a non-critical sidebar module with nothing to say renders NOTHING rather
 * than a placeholder box, so it cannot occupy a large area of the page.
 *
 * `SectionState`'s own chrome (border + card background) is flattened here via
 * `className`, because the panel already provides the surface — otherwise the
 * state box would draw a border inside a border.
 *
 * The date is rendered only when the payload carries `publishedAt`; an
 * announcement without one shows no date rather than today's.
 */
export function AnnouncementPanel({
  status,
  items,
}: {
  status: SectionStatus;
  items: AnnouncementSummary[];
}) {
  if (status === "empty") return null;

  return (
    <section
      aria-labelledby="home-announcements"
      className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-none"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="home-announcements" className="text-sm font-semibold text-primary">
          社区公告
        </h2>
        <Link to="/announcements" className="shrink-0 text-xs text-accent hover:underline">
          全部 ›
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无公告" className="border-0 bg-transparent p-0">
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => {
            const day = formatMonthDay(item.publishedAt);
            return (
              <li key={item.id}>
                <Link
                  to={`/announcements/${encodeURIComponent(item.id)}`}
                  className="flex items-start gap-2 text-sm"
                >
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground hover:text-accent">
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                  </span>
                  {day ? (
                    <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                      {day}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionState>
    </section>
  );
}
