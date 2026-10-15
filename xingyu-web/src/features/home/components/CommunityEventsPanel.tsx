import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { SectionState, type SectionStatus } from "@/components/shared/SectionState";
import { formatEventDay, isEventEnded, type EventView } from "@/api/events/events.types";

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
 * TIME SEMANTICS: the server list is ordered by starts_at DESC and knows nothing
 * about ended-ness, so the rail must not simply take the newest N — that could
 * drop a genuinely live event behind an ended one. Ended events are demoted to
 * the end and labelled 「已结束」 so the rail never implies they are joinable.
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
  now = Date.now(),
}: {
  status: SectionStatus;
  items: EventView[];
  now?: number;
}) {
  if (status === "empty") return null;

  // Stable partition: not-ended first (in server order), ended last. Filtering
  // before slicing is the point — otherwise a genuinely live event could be
  // truncated away by older-but-ended rows the server happened to return first.
  const open = items.filter((event) => isEventEnded(event, now) !== true);
  const closed = items.filter((event) => isEventEnded(event, now) === true);
  const events = [...open, ...closed].slice(0, EVENT_LIMIT);

  return (
    <section
      aria-labelledby="home-events"
      className="sidebar-card group rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/50 p-5 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="home-events" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </span>
          社区活动
        </h2>
        <Link
          to="/events"
          className="group/link shrink-0 inline-flex items-center gap-1 text-xs text-accent-strong transition-all hover:gap-1.5 hover:text-accent-strong/80"
        >
          <span>查看全部</span>
          <svg
            className="h-3 w-3 transition-transform group-hover/link:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无活动" className="border-0 bg-transparent p-0">
        <ul className="flex flex-col gap-2">
          {events.map((event) => {
            const range = formatRange(event.startsAt, event.endsAt);
            const ended = isEventEnded(event, now) === true;
            return (
              <li key={event.id}>
                <Link
                  to={`/events/${encodeURIComponent(event.id)}`}
                  className="glow-border block rounded-lg border border-border/60 bg-surface-sunken/30 p-3 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm"
                >
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                    {event.title}
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ended ? (
                      /* 11px, the micro step every pill in the app uses — and the
                         step this exact badge now sits at on the plaza card, the
                         detail header and /me/events. It was the fourth copy of
                         one badge and the only one at 10px, one pixel under the
                         floor, which is the kind of gap nobody can name and
                         everybody can see once the surfaces are compared.

                         The panel's own surface language is left alone: this is
                         the home rail, it sits on `bg-surface-sunken/55` beside
                         AnnouncementPanel and RecommendedCreatorsPanel, and its
                         row text is at the rail's step. Only the badge converged,
                         because the badge is the one thing here that belongs to
                         another feature. */
                      <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                        已结束
                      </span>
                    ) : null}
                    {range ? <span className="font-medium">{range}</span> : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionState>
    </section>
  );
}
