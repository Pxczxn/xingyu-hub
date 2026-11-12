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
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { PageHero } from "@/components/shared/PageHero";
import { IllustrationSlot, LostOrbit } from "@/components/shared/illustrations";
import { Button } from "@/components/ui/button";
import { EventDateBlock } from "../components/EventDateBlock";
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
 *
 * 2026-11-10（批次 W1）—— 骨架按 A §3 的 Events 行取 SK2 · 幅/紧/错：
 *
 *   1. `ArchetypeFrame skeleton="SK2"` + 传 `rail` ⇒ `lg:[1fr | 320px]`，右轨由
 *      `SectionRail` 粘住。这就是 R=**错**（主列 + 侧轨）；右轨里是日历与「即将
 *      开始」，它们是对活动列表的注解，不是列表本身。
 *   2. `header="banner"` ⇒ H=**幅**：`PageHero` 有面横幅。四个广场页（话题/系列/
 *      星系/活动）都开横幅，本页不破这个先例。
 *   3. `density="compact"` ⇒ D=**紧**：条目是**行**，没有逐项卡面。行分隔靠
 *      `FeedRow` 的发丝线。这是与同域以外的 `GalaxyListPage`（SK2·幅/松/出）最直接
 *      的区分：那页每张星系卡是独立卡面并带成员数，本页每一行是发丝线分隔的活动行，
 *      行首是日期块、行尾是状态与出口。
 *
 * 关于「报名数」：`EventView` 只有 id/slug/title/body/startsAt/endsAt/submissionOpen
 * （`events.types.ts:82-92`，规则 4 明写「no capacity」），公开列表也没有报名计数，
 * 所以本页**不渲染报名数**——那会是一句编造。行内可比较的事实是时间窗与投稿状态。
 *
 * 2026-10-13 (batch 07b) — three things changed across this page and its three
 * siblings (detail / submit / mine), and they are stated once here because all
 * four follow them:
 *
 *   1. SURFACE. Borders are `border-border/70`. The 70% border is the outer frame;
 *      anything nested inside keeps a full-strength divider.
 *   2. TYPE SCALE. tokens.css declares four steps — display 28 / title 18 /
 *      card 15 / meta 13. This domain had drifted onto `text-xs` (12px) and
 *      `text-[10px]`, which are not steps at all. The one deliberate exception is
 *      the status chip, which keeps the 11px micro step that `.eyebrow` and every
 *      other pill in the app already use — a chip is a badge, not prose.
 *   3. MOTION. 行流不再逐条错峰。`FeedRow` 是 D=紧 的行制原语，它没有 `style` 槽，
 *      而错峰延迟必须内联（`animate-rise-in` 是 `animation` 简写，会把
 *      `animation-delay` 重置为 0，见 `lib/stagger.ts`）。已迁移的同类行流页
 *      （`MyLikesPage` / `BookshelfPage` / `FollowListPage`）同样不错峰；页面级的
 *      `animate-page-enter` 仍由 `AppLayout` 播一次。
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
  if (isFutureStart(event, now)) return "即将开始";
  return event.submissionOpen ? "开放投稿" : "暂未开放投稿";
}

/**
 * True only when the event has not started yet. A missing/invalid `startsAt`
 * yields false — "unknown" must not be promoted into an upcoming promise.
 */
function isFutureStart(event: EventView, now: number): boolean {
  if (!event.startsAt) return false;
  const start = new Date(event.startsAt).getTime();
  if (Number.isNaN(start)) return false;
  return start > now;
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

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

  /*
    Time semantics (locked): `status=ACTIVE` is a publish state, not a running
    state. The three buckets are mutually exclusive and derived from the window
    only:
      - ended   : endsAt non-null and now >= endsAt
      - upcoming: not ended and startsAt is strictly in the future
      - running : not ended and startsAt is NOT in the future (i.e. startsAt <= now)
    `endsAt=null` means "no auto-end configured" and is never treated as ended.
    A server row whose start is already in the past is NOT upcoming — listing it
    under 「即将开始」 would be a lie.
    Conversely a not-yet-started event must NOT be counted as 「进行中」: the two
    labels describe disjoint states, so `future` is subtracted from `live`.
    Advance registration before `startsAt` is an accepted product rule, so this
    is purely a display partition — it adds no start-time write gate.

    Plain derivations rather than `useMemo`: they are one pass over a list the
    page already holds, and the memo variants would only add stale-closure
    warnings on a `const` that is reassigned per render.
  */
  const ended = events.filter((event) => isEventEnded(event, now) === true);
  const upcoming = events.filter(
    (event) => isEventEnded(event, now) !== true && isFutureStart(event, now),
  );
  const live = events.filter(
    (event) => isEventEnded(event, now) !== true && !isFutureStart(event, now),
  );

  if (state.kind === "loading") return <PageState kind="loading" />;

  const hasEvents = state.kind === "ready" && events.length > 0;
  const shiftMonth = (delta: number) =>
    setCalendarDate((date) => new Date(date.getFullYear(), date.getMonth() + delta, 1));

  return (
    <ArchetypeFrame
      skeleton="SK2"
      header="banner"
      density="compact"
      headerSlot={
        <PageHero
          eyebrow="EVENTS"
          title="社区活动"
          description="探索正在进行的活动，和同好一起参与创作。"
          illustration={
            <IllustrationSlot id="hero" fallback={<LostOrbit className="h-full w-full" />} />
          }
        />
      }
      /*
       * 右轨只在真有活动时出现：日历的用处是把列表上的日期映射到月历，没有列表时
       * 它只是一片没有标记的格子。「即将开始」同理会退化成一句「暂无」，与空态
       * 重复。无 rail 时 frame 自动退回单列（`SOLO.SK2`）。
       */
      rail={
        hasEvents ? (
          <EventsRail
            monthTitle={monthTitle}
            monthDays={monthDays}
            month={calendarDate.getMonth()}
            eventDays={eventDays}
            upcoming={upcoming}
            now={now}
            onShiftMonth={shiftMonth}
          />
        ) : null
      }
      railLabel="活动侧栏"
    >
      {state.kind === "error" ? (
        <>
          <PageState
            kind="error"
            title="活动加载失败"
            description={state.detail ?? "无法读取活动列表，请稍后重试。"}
          />
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        </>
      ) : events.length === 0 ? (
        <PageState
          kind="empty"
          title="暂未发布活动"
          description="新的活动发布后，会在这里与大家见面。"
        />
      ) : (
        <>
          {/*
            首行是「焦点行」而不是「焦点卡」。D=紧 的判据是「无逐项卡面」，
            所以它和下面的行共用同一条发丝线骨架，只靠**更大的日期块 + 倒计时 +
            主按钮**表达优先级；再给它套一张卡面就等于在这一页里混进第二种行制
            （B §7 R3）。

            The server's own first still-open row is the feature — not a client
            re-rank. An ended event must never be the hero, so the live set drives
            this.
          */}
          {live.length > 0 ? <EventRow event={live[0]} now={now} featured /> : null}

          <section aria-labelledby="events-live">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 id="events-live" className="section-heading">
                进行中的活动
              </h2>
              <span className="text-meta tabular-nums text-muted-foreground">
                共 {live.length} 场
              </span>
            </div>
            {live.length === 0 ? (
              <p className="mt-3 text-meta text-muted-foreground">当前没有进行中的活动。</p>
            ) : (
              <ul aria-label="活动列表" className="mt-1 flex flex-col">
                {live.map((event) => (
                  <EventRow key={event.id} event={event} now={now} />
                ))}
              </ul>
            )}
          </section>

          {/*
            Ended events stay browsable as history, but are visibly separated
            from what a reader can still join. The layout doc calls this bucket
            "P3, 去饱和" — and the desaturation is done by MOVING THE TEXTURE, not
            by lowering opacity: the date block drops its gold (`muted`) and the
            status chip goes grey, while every word keeps full contrast.

            The stagger restarts at 0 rather than continuing from the live list.
            They are two independent lists, and a reader who scrolls down to the
            ended block should watch it fill in — not catch the tail of an
            animation that started above the fold.
          */}
          {ended.length > 0 ? (
            <section aria-labelledby="events-ended">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h2 id="events-ended" className="section-heading">
                  已结束
                </h2>
                <span className="text-meta tabular-nums text-muted-foreground">
                  共 {ended.length} 场
                </span>
              </div>
              <ul aria-label="已结束的活动列表" className="mt-1 flex flex-col">
                {ended.map((event) => (
                  <EventRow key={event.id} event={event} now={now} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </ArchetypeFrame>
  );
}

/**
 * 一条活动行（D=紧）。
 *
 * 行制由 `FeedRow` 提供（发丝线分隔、无卡面、整行不是单一链接）；本组件只决定
 * 三件事：行首日期块、行中标题与时间窗、行尾状态与出口。
 *
 * `featured` 只放大日期块并常驻主按钮，不换行制 —— 见 `EventsPage` 里焦点行的
 * 注释：一页之内不混两种行制（B §7 R3）。
 */
function EventRow({
  event,
  now,
  featured = false,
}: {
  event: EventView;
  now: number;
  featured?: boolean;
}) {
  const day = formatEventDay(event.startsAt);
  const ended = isEventEnded(event, now) === true;
  const countdown = eventCountdown(event, now);
  const startLabel = formatEventDateTime(event.startsAt);
  const endLabel = formatEventDateTime(event.endsAt);
  /* 只有焦点行会给常驻主按钮；其余行的出口在行尾，与状态同一行。 */
  const cta = ended ? "查看详情" : event.submissionOpen ? "去参与" : "查看详情";

  return (
    <FeedRow
      as={featured ? "article" : "li"}
      meta={
        <>
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[11px] font-medium",
              ended
                ? "border-border bg-surface-sunken text-muted-foreground"
                : "border-accent-line/60 bg-accent-soft text-accent-strong",
            )}
          >
            {statusLabel(event, now)}
          </span>
          <Link
            to={`/events/${encodeURIComponent(event.id)}`}
            className="focus-ring rounded-md border border-input px-3 py-1.5 text-meta text-foreground transition-colors hover:bg-surface-sunken"
          >
            {featured ? (event.submissionOpen && !ended ? "立即参与" : "查看活动") : cta}
          </Link>
        </>
      }
      lead={
        <span title={day ?? undefined}>
          <EventDateBlock startsAt={event.startsAt} muted={ended} size={featured ? "large" : "compact"} />
        </span>
      }
    >
      <h3 className={cn("truncate text-primary", featured ? "text-h3" : "text-card font-semibold")}>
        {event.title}
      </h3>
      <p className="mt-0.5 line-clamp-2 text-meta text-muted-foreground">
        {event.body?.trim() || (featured ? "活动说明将在详情页中展示。" : "活动详情将在进入活动后展示。")}
      </p>
      {/*
        时间窗是这一行里唯一可比较的事实（报名数不在 payload 里，见文件头）。
        倒计时只在这一页唯一一处保持金色：它是会改变读者下一步的那个数字。
      */}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta">
        <span className="flex items-center gap-1 text-foreground-soft">
          <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {startLabel ? `开始 ${startLabel}` : "开始时间待公布"}
        </span>
        {endLabel ? (
          <span className="text-muted-foreground">结束 {endLabel}</span>
        ) : (
          <span className="text-muted-foreground">结束时间待公布</span>
        )}
        {countdown ? (
          <span className="font-medium text-accent-strong">距离结束 {countdown}</span>
        ) : null}
      </p>
    </FeedRow>
  );
}

/**
 * 右轨：活动日历 + 「即将开始」。
 *
 * 它只是一个**内容组件** —— 粘住、滚动与 landmark 由 `ArchetypeFrame` 里的
 * `SectionRail` 负责（`SectionRail.tsx:41-56`），所以这里没有第二个 `<aside>`：
 * 两层 aside 会让页面出现两个同名区域。
 *
 * 日历本身属于渲染辅助：它只标记本页已取回的活动，不发请求、不改任何状态。
 * `onShiftMonth` 是父级的 `setCalendarDate`，翻月同样不触发重新拉取。
 */
function EventsRail({
  monthTitle,
  monthDays,
  month,
  eventDays,
  upcoming,
  now,
  onShiftMonth,
}: {
  monthTitle: string;
  monthDays: Date[];
  /** 当前月的 `getMonth()`，用于把跨月补齐的格子压暗。 */
  month: number;
  eventDays: Set<string>;
  upcoming: EventView[];
  now: number;
  onShiftMonth: (delta: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section aria-label="活动日历" className="rounded-card border border-border/70 bg-card p-4">
        {/*
          `flex-wrap` here is not decoration. At 18px the heading (icon +
          four glyphs, ~93px) plus the month stepper (~144px) plus the gap
          is 245px inside a 320px rail minus 32px of padding — it fits, but
          by a few pixels. Wrapping is the failure mode that degrades
          gracefully if a font ever measures wider than this one.
        */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-heading flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden />
            活动日历
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="上个月"
              onClick={() => onShiftMonth(-1)}
              className="focus-ring grid h-7 w-7 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </button>
            {/* `min-w-20` stays. It is a floor, not a width: without it the
                stepper arrows shift left and right every time the month
                label changes between one and two digits. */}
            <span className="min-w-20 text-center text-meta text-muted-foreground">
              {monthTitle}
            </span>
            <button
              type="button"
              aria-label="下个月"
              onClick={() => onShiftMonth(1)}
              className="focus-ring grid h-7 w-7 place-items-center rounded border border-border text-muted-foreground transition-colors hover:bg-surface-sunken hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={monthTitle}>
          {/*
            The weekday row keeps the 11px micro step — the same one `.eyebrow`
            and every pill in the app already use — and does NOT go up to
            `text-meta`. It has to stay smaller than the day numbers under it, or
            the column labels would outweigh the data they label; 13px labels
            above 13px numbers is not a hierarchy.
          */}
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="text-[11px] text-muted-foreground">
              {weekday}
            </span>
          ))}
          {monthDays.map((day) => {
            const inMonth = day.getMonth() === month;
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
                  "grid h-7 place-items-center rounded text-meta",
                  !inMonth && "text-muted-foreground/40",
                  inMonth && !marked && "text-foreground",
                  marked && "bg-accent/20 font-semibold text-accent-strong",
                )}
              >
                {day.getDate()}
              </span>
            );
          })}
        </div>
      </section>

      <section className="rounded-card border border-border/70 bg-card p-4">
        <h2 className="section-heading">即将开始</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-meta text-muted-foreground">暂无即将开始的活动。</p>
        ) : (
          /*
            All three lines sit at `text-meta` and are told apart by weight
            and colour instead of by size. A rail has no room for a fourth type
            step, and shrinking the date and the status to 12px and 10px — which
            is what this row used to do — made the two facts a reader is actually
            scanning for the hardest things to read.
          */
          <ul className="mt-2 flex flex-col gap-2">
            {upcoming.slice(0, 3).map((event) => (
              <li key={event.id}>
                <Link
                  to={`/events/${encodeURIComponent(event.id)}`}
                  className="focus-ring flex items-start gap-2 rounded-md p-1.5 transition-colors hover:bg-surface-sunken"
                >
                  <time className="shrink-0 text-meta tabular-nums text-muted-foreground">
                    {formatEventDay(event.startsAt) ?? "待定"}
                  </time>
                  <span className="min-w-0">
                    <span className="block truncate text-meta font-medium text-foreground">
                      {event.title}
                    </span>
                    <span className="text-meta text-muted-foreground">{statusLabel(event, now)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
