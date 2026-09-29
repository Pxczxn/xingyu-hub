import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import {
  eventCountdown,
  formatEventDateTime,
  formatEventDay,
  isEventEnded,
  type EventView,
} from "@/api/events/events.types";
import { PageState } from "@/components/shared/PageState";
import { cn } from "@/lib/cn";

/*
 * The events square (Phase 2I-4) — a public, guest-readable page.
 *
 * `GET /events` returns ACTIVE events as a bare array, already ordered by the
 * mapper. Nothing is re-sorted here; the first row is the featured one because
 * that is the order the server chose, not because the client re-ranked it.
 *
 * Status copy is derived from the two things the payload actually carries, and
 * deliberately not from `submissionOpen` alone (see events.types.ts rule 2):
 *   ended (endsAt passed)  -> 已结束
 *   submissionOpen         -> 开放投稿
 *   otherwise              -> 暂未开放投稿
 * A closed-submission event that is still running must NOT read as 已结束.
 *
 * The calendar marks days that carry an event. It is a rendering aid over data
 * already fetched — it fetches nothing itself, which is why it has no loading or
 * error state of its own.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; detail: string | null }
  | { kind: "ready"; items: EventView[] };

const LIMIT = 20;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** A 6x7 grid covering the month, padded from the preceding Sunday. */
function monthGrid(viewDate: Date): Date[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

/** The CST calendar day an instant falls on, as a comparable key. */
function cstDayKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function statusLabel(event: EventView, now: number): string {
  if (isEventEnded(event, now) === true) return "已结束";
  return event.submissionOpen ? "开放投稿" : "暂未开放投稿";
}

/**
 * `now` is injectable so the page can be rendered at a fixed instant in tests.
 * Faking the clock globally would also stop testing-library's own polling from
 * advancing, so the seam is a parameter rather than `vi.useFakeTimers()`.
 * In production it is never passed and the page reads the real clock.
 */
export function EventsPage({ now = Date.now() }: { now?: number } = {}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [calendarDate, setCalendarDate] = useState(() => new Date(now));

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    eventsApi
      .list(LIMIT)
      .then((items) => {
        if (active) setState({ kind: "ready", items });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  const events = state.kind === "ready" ? state.items : [];

  // Days in the visible month that carry an event, in CST.
  const eventDays = useMemo(() => {
    const keys = new Set<string>();
    for (const event of events) {
      const key = cstDayKey(event.startsAt);
      if (key) keys.add(key);
    }
    return keys;
  }, [events]);

  const monthDays = useMemo(() => monthGrid(calendarDate), [calendarDate]);
  const monthTitle = `${calendarDate.getFullYear()}年${calendarDate.getMonth() + 1}月`;
  const upcoming = events.filter((event) => event.startsAt).slice(0, 3);

  if (state.kind === "loading") return <PageState kind="loading" />;

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">社区活动</h1>
        <p className="text-sm text-muted-foreground">
          发现正在进行的活动，和同好一起参与创作。
        </p>
      </header>

      {state.kind === "error" ? (
        <PageState
          kind="error"
          title="活动加载失败"
          description={state.detail ?? "无法读取活动列表，请稍后重试。"}
        />
      ) : events.length === 0 ? (
        <PageState
          kind="empty"
          title="暂未发布活动"
          description="新的活动发布后，会在这里与大家见面。"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="flex flex-col gap-6" aria-label="活动内容">
            {/* The server's own first row is the feature — not a client re-rank. */}
            <FeatureCard event={events[0]} now={now} />

            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-foreground">进行中的活动</h2>
                <span className="text-xs text-muted-foreground">共 {events.length} 场</span>
              </div>
              <ul aria-label="活动列表" className="grid gap-3 sm:grid-cols-2">
                {events.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} now={now} />
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <aside className="flex flex-col gap-4" aria-label="活动日历">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  活动日历
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="上个月"
                    onClick={() =>
                      setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))
                    }
                    className="grid h-7 w-7 place-items-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <span className="min-w-20 text-center text-xs text-muted-foreground">{monthTitle}</span>
                  <button
                    type="button"
                    aria-label="下个月"
                    onClick={() =>
                      setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))
                    }
                    className="grid h-7 w-7 place-items-center rounded border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={monthTitle}>
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday} className="text-[10px] text-muted-foreground">
                    {weekday}
                  </span>
                ))}
                {monthDays.map((day) => {
                  const inMonth = day.getMonth() === calendarDate.getMonth();
                  // `eventDays` keys are CST strings, so they only match days in
                  // the month the browser is currently in — an off-by-one would
                  // mark the wrong square, which is why the key is built the
                  // same way on both sides rather than from getDate().
                  const marked = inMonth && eventDays.has(dayKey(day));
                  return (
                    <span
                      key={day.toISOString()}
                      data-event={marked ? "true" : undefined}
                      aria-label={marked ? `${day.getDate()} 日有活动` : undefined}
                      className={cn(
                        "grid h-7 place-items-center rounded text-xs",
                        !inMonth && "text-muted-foreground/40",
                        inMonth && !marked && "text-foreground",
                        marked && "bg-accent/20 font-semibold text-accent",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">即将开始</h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">暂无带开始时间的活动安排。</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {upcoming.map((event) => (
                    <li key={event.id}>
                      <Link
                        to={`/events/${encodeURIComponent(event.id)}`}
                        className="flex items-start gap-2 rounded-md p-1.5 hover:bg-muted"
                      >
                        <time className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatEventDay(event.startsAt) ?? "待定"}
                        </time>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {event.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {statusLabel(event, now)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

/** The featured row. `body` is the description and may be empty. */
function FeatureCard({ event, now }: { event: EventView; now: number }) {
  const countdown = eventCountdown(event, now);
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-accent/5 p-5">
      <span className="self-start rounded border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
        {statusLabel(event, now)}
      </span>
      <h2 className="text-lg font-semibold text-primary">{event.title}</h2>
      <p className="text-sm text-muted-foreground">
        {event.body?.trim() || "活动说明将在详情页中展示。"}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {event.startsAt ? (
          <span className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            开始 {formatEventDateTime(event.startsAt)}
          </span>
        ) : (
          <span>开始时间待公布</span>
        )}
        {/* Countdown only when there is an end still ahead; "undefined 小时"
            would be worse than saying nothing. */}
        {countdown ? <span>距离结束 {countdown}</span> : null}
      </p>
      <Link
        to={`/events/${encodeURIComponent(event.id)}`}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        {event.submissionOpen ? "立即参与" : "查看活动"}
      </Link>
    </article>
  );
}

function EventCard({ event, now }: { event: EventView; now: number }) {
  const day = formatEventDay(event.startsAt);
  const ended = isEventEnded(event, now) === true;
  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <time className="grid h-11 w-14 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold tabular-nums text-foreground">
          {day ?? "待定"}
        </time>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{event.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {event.body?.trim() || "活动详情将在进入活动后展示。"}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className={cn("text-[10px]", ended ? "text-muted-foreground" : "text-accent")}>
          {statusLabel(event, now)}
        </span>
        <Link
          to={`/events/${encodeURIComponent(event.id)}`}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
        >
          {ended ? "查看详情" : event.submissionOpen ? "去参与" : "查看详情"}
        </Link>
      </div>
    </article>
  );
}

