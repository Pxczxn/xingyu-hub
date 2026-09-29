import { Link } from "react-router-dom";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
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
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="home-announcements" className="text-sm font-semibold text-primary">
          社区公告
        </h2>
        <Link to="/announcements" className="shrink-0 text-xs text-accent hover:underline">
          全部 ›
        </Link>
      </div>

      <SectionState
        status={status}
        emptyText="暂无公告"
        className="border-0 bg-transparent p-0"
      >
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/announcements/${encodeURIComponent(item.id)}`}
                className="text-sm font-medium text-foreground hover:text-accent"
              >
                {item.title}
              </Link>
              {item.body ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionState>
    </section>
  );
}
