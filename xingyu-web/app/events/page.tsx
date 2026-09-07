"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Sparkles, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { communityApi, type EventSummary } from "@/lib/community-api";

const CARD_ARTS = ["event-1", "event-2", "event-3", "event-4"];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function eventHref(event: EventSummary) {
  return `/events/${encodeURIComponent(event.id)}`;
}

function toDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateLabel(value?: string) {
  const date = toDate(value);
  if (!date) return "时间待公布";
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function timeLabel(value?: string) {
  const date = toDate(value);
  if (!date) return "";
  return `${WEEKDAYS[date.getDay()]} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(event: EventSummary) {
  return event.submissionOpen ? "开放参与" : "活动预告";
}

function monthTitle(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function createMonthGrid(viewDate: Date) {
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

export default function EventsPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  useEffect(() => {
    communityApi
      .getEvents(20)
      .then((result) => setEvents(result))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const feature = events[0];
  const visibleEvents = events.slice(0, 4);
  const monthDays = useMemo(() => createMonthGrid(calendarDate), [calendarDate]);
  const eventDays = useMemo(
    () =>
      new Set(
        events
          .map((event) => toDate(event.startsAt))
          .filter((date): date is Date => Boolean(date))
          .filter(
            (date) =>
              date.getFullYear() === calendarDate.getFullYear() &&
              date.getMonth() === calendarDate.getMonth(),
          )
          .map((date) => date.getDate()),
      ),
    [calendarDate, events],
  );
  const upcoming = events.filter((event) => event.startsAt).slice(0, 3);

  return (
    <AppShell>
      <main className="xy-event-real">
        <section className="xy-event-real-intro" aria-labelledby="events-heading">
          <p>探索星空之美，分享知识与热情</p>
          <h1 id="events-heading">社区活动</h1>
          <p>在这里，发现更多有趣的活动，结识志同道合的朋友。</p>
        </section>

        <div className="xy-event-real-grid">
          <section className="xy-event-real-main" aria-label="活动内容">
            {loading ? (
              <section className="xy-event-real-feature xy-event-real-loading" aria-busy="true">
                <span>正在加载活动</span>
              </section>
            ) : feature ? (
              <article className="xy-event-real-feature">
                <Image
                  src="/prototype-assets/activity-plaza/hero-art.png"
                  alt=""
                  aria-hidden="true"
                  width={577}
                  height={204}
                  priority
                />
                <div className="xy-event-real-feature-copy">
                  <span>{statusLabel(feature)}</span>
                  <h2>{feature.title}</h2>
                  {feature.body ? <p>{feature.body}</p> : <p>活动说明将在详情页中展示。</p>}
                  {feature.startsAt ? (
                    <small>
                      <Clock3 /> {dateLabel(feature.startsAt)} {timeLabel(feature.startsAt)}
                      {feature.endsAt ? ` — ${dateLabel(feature.endsAt)} ${timeLabel(feature.endsAt)}` : ""}
                    </small>
                  ) : null}
                </div>
                <Button asChild className="xy-event-real-feature-action">
                  <Link href={eventHref(feature)}>{feature.submissionOpen ? "立即参与" : "查看活动"}</Link>
                </Button>
              </article>
            ) : (
              <section className="xy-event-real-feature xy-event-real-empty-feature" role="status">
                <span>活动广场</span>
                <h2>{error ? "活动信息暂时无法加载" : "暂未发布活动"}</h2>
                <p>{error ? "请稍后重新进入此页面查看。" : "新的活动发布后，会在这里与大家见面。"}</p>
              </section>
            )}

            <header className="xy-event-real-section-title">
              <h2>进行中的活动</h2>
              <span>{events.length > 0 ? `共 ${events.length} 场` : ""}</span>
            </header>

            {visibleEvents.length > 0 ? (
              <div className="xy-event-real-cards">
                {visibleEvents.map((event, index) => (
                  <article key={event.id} className="xy-event-real-card">
                    <div className="xy-event-real-card-art" aria-hidden="true">
                      <Image
                        src={`/prototype-assets/activity-plaza/${CARD_ARTS[index % CARD_ARTS.length]}.png`}
                        alt=""
                        fill
                        sizes="(max-width: 780px) 90vw, 260px"
                      />
                      <span>{statusLabel(event)}</span>
                    </div>
                    <div className="xy-event-real-card-copy">
                      <time dateTime={event.startsAt}>
                        <b>{dateLabel(event.startsAt)}</b>
                        <small>{timeLabel(event.startsAt) || "时间待公布"}</small>
                      </time>
                      <div>
                        <h3>{event.title}</h3>
                        <p>{event.body || "活动详情将在进入活动后展示。"}</p>
                      </div>
                    </div>
                    <footer>
                      <span><UsersRound /> {event.submissionOpen ? "开放参与" : "暂未开放投稿"}</span>
                      <Button variant="outline" asChild>
                        <Link href={eventHref(event)}>{event.submissionOpen ? "去参与" : "查看详情"}</Link>
                      </Button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : !loading ? (
              <section className="xy-event-real-list-empty" role="status">
                {error ? "活动列表加载失败，请稍后重试。" : "暂无进行中的活动。"}
              </section>
            ) : null}

            <aside className="xy-event-real-create">
              <div className="xy-event-real-create-mark" aria-hidden="true"><Sparkles /></div>
              <div>
                <h3>想发起活动？</h3>
                <p>活动发起入口将在开放后显示；先用内容和交流聚集同好。</p>
              </div>
              <Button variant="outline" disabled>敬请期待</Button>
            </aside>
          </section>

          <aside className="xy-event-real-calendar" aria-label="活动日历">
            <header>
              <h2><CalendarDays /> 活动日历</h2>
              <div className="xy-event-real-calendar-switch">
                <button
                  type="button"
                  aria-label="上个月"
                  onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}
                ><ChevronLeft /></button>
                <span>{monthTitle(calendarDate)}</span>
                <button
                  type="button"
                  aria-label="下个月"
                  onClick={() => setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}
                ><ChevronRight /></button>
              </div>
            </header>
            <div className="xy-event-real-month" role="grid" aria-label={monthTitle(calendarDate)}>
              {WEEKDAYS.map((weekday) => <span className="xy-event-real-weekday" key={weekday}>{weekday}</span>)}
              {monthDays.map((day) => {
                const inMonth = day.getMonth() === calendarDate.getMonth();
                const marked = inMonth && eventDays.has(day.getDate());
                return <span className={`${!inMonth ? "is-muted " : ""}${marked ? "is-event" : ""}`} key={day.toISOString()}>{day.getDate()}</span>;
              })}
            </div>
            <div className="xy-event-real-upcoming">
              <h3>即将开始</h3>
              {upcoming.length > 0 ? upcoming.map((event) => (
                <Link className="xy-event-real-upcoming-item" href={eventHref(event)} key={event.id}>
                  <time dateTime={event.startsAt}><b>{dateLabel(event.startsAt)}</b><small>{timeLabel(event.startsAt)}</small></time>
                  <span><em>{statusLabel(event)}</em><b>{event.title}</b></span>
                </Link>
              )) : <p className="xy-event-real-upcoming-empty">暂无带开始时间的活动安排。</p>}
            </div>
          </aside>
        </div>
      </main>
    </AppShell>
  );
}
