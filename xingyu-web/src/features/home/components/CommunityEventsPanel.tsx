import { Link } from "react-router-dom";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { formatEventDay, type EventView } from "@/api/events/events.types";

/*
 * 社区活动 — sidebar module.
 *
 * Reads the public event list (GET /api/v1/events, ACTIVE events only — the
 * server 404s a non-ACTIVE one rather than hiding it).
 *
 * WHAT IS DELIBERATELY ABSENT: a participant count. `EventView` carries no
 * registration total, and the only way to derive one would be to page the whole
 * registration table. So the card shows the title and the date range, and stops.
 * A fabricated "1.2k 人参与" would be worse than the empty space it fills.
 *
 * `submissionOpen` is NOT rendered either: it says whether submissions are
 * open, which is not "the event is over", and a sidebar is the wrong place to
 * explain that distinction. The detail page owns it.
 */

/** How many events the rail shows, and how many the page asks the API for. */
export const EVENT_LIMIT = 2;

/** 「12/01 - 12/31」, or whichever half of the range the payload actually has. */
function formatRange(startsAt?: string | null, endsAt?: string | null): string | null {
  const start = formatEventDay(startsAt);
  const end = formatEventDay(endsAt);
  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} 起`;
  if (end) return `截止 ${end}`;
  return null;
}

export function CommunityEventsPanel({
  status,
  items,
}: {
  status: SectionStatus;
  items: EventView[];
}) {
  if (status === "empty") return null;

  const events = items.slice(0, EVENT_LIMIT);

  return (
    <section
      aria-labelledby="home-events"
      className="rounded-xl border border-border/70 bg-card/95 p-4 shadow-none"
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 id="home-events" className="text-sm font-semibold text-primary">
          社区活动
        </h2>
        <Link to="/events" className="shrink-0 text-xs text-accent hover:underline">
          全部 ›
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无活动" className="border-0 bg-transparent p-0">
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => {
            const range = formatRange(event.startsAt, event.endsAt);
            return (
              <li key={event.id}>
                <Link
                  to={`/events/${encodeURIComponent(event.id)}`}
                  className="block rounded-md border border-border/70 p-2.5 transition-colors hover:bg-muted/70"
                >
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{event.title}</p>
                  {range ? <p className="mt-1 text-xs text-muted-foreground">{range}</p> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionState>
    </section>
  );
}
