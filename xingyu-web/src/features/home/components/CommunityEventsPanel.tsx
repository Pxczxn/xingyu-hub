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

/**
 * 日期块的月/日。只用 `startsAt`，缺失或不可解析时返回 null —— 不拿「今天」
 * 兜底，那会把一个没有日期的事件显示成今天开始。
 */
function startDayParts(startsAt?: string | null): { month: number; day: number } | null {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  return { month: date.getMonth() + 1, day: date.getDate() };
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
      className="rounded-2xl border border-border/60 bg-card/60 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="home-events"
          className="flex items-center gap-2 text-[13px] font-semibold text-foreground"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent-soft text-accent-strong">
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </span>
          社区活动
        </h2>
        <Link
          to="/events"
          className="shrink-0 text-[11px] text-muted-foreground transition-colors hover:text-accent-strong"
        >
          查看全部 →
        </Link>
      </div>

      <SectionState status={status} emptyText="暂无活动" className="border-0 bg-transparent p-0">
        <ul className="flex flex-col gap-1">
          {events.map((event) => {
            const range = formatRange(event.startsAt, event.endsAt);
            const ended = isEventEnded(event, now) === true;
            const day = startDayParts(event.startsAt);
            return (
              <li key={event.id}>
                {/*
                  日期块 + 标题。日期来自 `startsAt`（服务端字段），没有就退化为
                  纯标题，不画空方块。已结束只做徽标，不改变链接。
                */}
                <Link
                  to={`/events/${encodeURIComponent(event.id)}`}
                  className="-mx-1.5 flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-accent-soft/50"
                >
                  {day ? (
                    <span
                      aria-hidden
                      className="w-11 shrink-0 rounded-lg bg-accent-soft py-1 text-center"
                    >
                      <span className="block text-[10px] font-medium leading-4 text-accent-strong">
                        {day.month}月
                      </span>
                      <span className="block text-[17px] font-semibold leading-5 tabular-nums text-accent-strong">
                        {day.day}
                      </span>
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13.5px] font-semibold leading-snug text-foreground">
                      {event.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {ended ? (
                        <span className="shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-medium">
                          已结束
                        </span>
                      ) : null}
                      {range ? <span className="font-medium">{range}</span> : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </SectionState>
    </section>
  );
}
