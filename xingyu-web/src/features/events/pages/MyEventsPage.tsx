import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import {
  SUBMISSION_OBJECT_LABELS,
  formatEventDay,
  isEventEnded,
  isSubmissionSettled,
  submissionStatusLabel,
  type EventSubmissionView,
  type EventView,
} from "@/api/events/events.types";
import { ArchetypeFrame, FeedRow } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";

/*
 * My events (Phase 2I-4) — the personal record of everything submitted.
 *
 * Two reads are combined deliberately:
 *   /me/event-submissions   every submission, any review status
 *   /events                 the active events, to name each submission's event
 *
 * A submission stores only `eventId`, so without the second read a row could
 * show a work title but not which event it belongs to — and the event link would
 * be unbuildable. The join is done here in one pass over a Map.
 *
 * A submission whose event is NOT in the active list keeps its row and loses its
 * link: the event list only ever contains ACTIVE events, so an event that was
 * taken down leaves the submission orphaned, and dropping the row would erase
 * the user's own history. It says 「活动已不在开放列表」 instead of pretending.
 *
 * Grouping is by REVIEW STATE, not by event lifecycle: there is no per-event
 * lifecycle available here (the event row carries only timestamps), so the tabs
 * are 待审核 / 已通过 / 未通过 — the three states the submissions actually have.
 *
 * 2026-10-13 (batch 07b). The domain-wide surface and type rules live at the top
 * of EventsPage.tsx; only what is specific to this page is repeated here:
 *
 *   1. THE LIST IS ONE SURFACE, NOT A GRID OF CARDS. These rows are records of
 *      the same kind, so a card around every row adds a border per row to say
 *      what one column edge already says — the argument written out in
 *      MyMomentsPage.tsx, and the shape /me/moments, /me/likes and /me/comments
 *      already share. This page is the fourth of that family and was the only one
 *      still drawing a card around each row.
 *
 *   2. THE STAGGER REPLAYS WHEN THE TAB CHANGES. `key={tab}` on the <ul> is the
 *      entire mechanism: a new key unmounts the list, so the rows animate in
 *      again for the bucket the reader just asked for. Without it the rows would
 *      simply swap, which reads as a filter that did nothing.
 *
 *   3. THE TAB COUNT IS A BADGE, NOT PROSE. It stays on the 11px micro step while
 *      the label beside it is 14px. A count that matches the size of its own
 *      label has stopped reading as a count.
 */

/*
 * 骨架（A §3 `/me/*` 表 · MyEvents = SK6 · 线/紧/错）
 * -----------------------------------------------
 * 这一页与 MyLikes / MyFollowing 同取 线/紧/错，与它们区分靠**条目内部结构**：
 * 本页一行要装三层事实（作品标题 → 投稿对象与审核口径 → 所属活动），因为它是
 * 「投稿记录」；MyLikes 只有「类型 → 标题」两层，Follow 是「头像 → 名字」。
 *
 *   H=线：`PageMasthead` —— 无面页头，标题贴内容列左缘、动作落在基线尾。原来那行
 *         `text-2xl font-semibold` 手写 h1（A §4 点名的 30 处之一）就此收敛，
 *         页面不再自己写宽度。
 *   D=紧：`FeedRow` 行式、发丝线分隔、无逐项卡面。原来每行外面套一层
 *         `rounded-xl border bg-card` 再加 `divide-y`，等于给同一条边描了两遍。
 *   R=错：`rail` 常驻，`ArchetypeFrame` 走 `lg:[1fr|300px]` —— 与同为 线/紧 的
 *         书架（齐，单列）和评论（松/齐）正好构成这一档的对照组。
 *
 * 右栏三块（投稿概览 / 推荐活动 / 说明）只用**本页已取回的数据**派生：`rows` 与
 * `activeEvents`。`EventView` 契约里没有 capacity，公开列表也不返回报名数，所以
 * 概览不写「已报名 / 剩余名额」，只写能逐条复核的事实：投稿总数、涉及活动数、
 * 进行中活动数、最近投稿日。宁可少一个数字，也不加假字段
 * （DECISIONS 2026-11-10 · 收尾批第 2 条）。
 *
 * 右栏在空态也不收起：`推荐活动` 的空文案「暂无可推荐活动。」本身就是页面说明的
 * 一部分，收起等于把一句真实信息藏起来（该文案还被测试钉住）。
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; rows: Row[]; activeEvents: EventView[] };

type Row = {
  submission: EventSubmissionView;
  /** Null when the event is not in the active list — the link is then omitted. */
  event: EventView | null;
};

type Bucket = "pending" | "accepted" | "rejected";

const LIMIT = 100;

const TABS: { id: Bucket; label: string }[] = [
  { id: "pending", label: "待审核" },
  { id: "accepted", label: "已通过" },
  { id: "rejected", label: "未通过" },
];

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

/** Which tab a submission belongs to. Unsettled rows are pending. */
function bucketOf(status: string): Bucket {
  const upper = status?.toUpperCase() ?? "";
  if (upper === "ACCEPTED" || upper === "APPROVED") return "accepted";
  if (upper === "REJECTED" || upper === "DISMISSED") return "rejected";
  return "pending";
}

export function MyEventsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<Bucket>("pending");
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    Promise.all([
      eventsApi.listMySubmissions(LIMIT),
      // The event list is decoration on top of the submissions: if the events
      // endpoint is down the user's own history must still render, minus links.
      eventsApi.list(LIMIT),
    ])
      .then(([submissions, events]) => {
        if (!active) return;
        const byId = new Map(events.map((event) => [event.id, event]));
        setState({
          kind: "ready",
          rows: submissions.map((submission) => ({
            submission,
            event: byId.get(submission.eventId) ?? null,
          })),
          activeEvents: events,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          expired: isAuthError(err),
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const rows = state.kind === "ready" ? state.rows : [];

  const counts = useMemo(() => {
    const result: Record<Bucket, number> = { pending: 0, accepted: 0, rejected: 0 };
    for (const row of rows) result[bucketOf(row.submission.status)] += 1;
    return result;
  }, [rows]);

  // Recommendations: events the user has never submitted to that have NOT
  // ended. An ended event is not a recommendation — offering it would send the
  // reader to a page where every write is refused by the server.
  const recommendations =
    state.kind === "ready"
      ? state.activeEvents
          .filter(
            (event) =>
              !state.rows.some((row) => row.submission.eventId === event.id) &&
              isEventEnded(event) !== true,
          )
          .slice(0, 5)
      : [];

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title="加载失败"
          description={
            state.expired
              ? "登录状态已过期，请重新登录。"
              : (state.detail ?? "无法读取你的活动记录，请稍后重试。")
          }
        />
        {state.expired ? (
          <p className="text-center">
            <Link to="/login" className="text-sm text-accent-strong hover:underline">
              去登录
            </Link>
          </p>
        ) : (
          /* Not an auth failure — the load itself failed, so offer the load
             again instead of leaving the reader at a dead end. */
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        )}
      </div>
    );
  }

  const visible = rows.filter((row) => bucketOf(row.submission.status) === tab);

  return (
    <ArchetypeFrame
      skeleton="SK6"
      header="line"
      density="compact"
      headerSlot={
        <PageMasthead
          title="我的活动"
          description={rows.length > 0 ? `共参与 ${rows.length} 项活动投稿` : "还没有活动投稿记录"}
          actions={
            <Link to="/events" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
              浏览活动
            </Link>
          }
        />
      }
      rail={
        <MyEventsRail
          rows={rows}
          activeEvents={state.activeEvents}
          recommendations={recommendations}
        />
      }
      /* landmark 名与三块面板标题不同名，否则同一句话会在无障碍树里出现两次。 */
      railLabel="活动侧栏"
    >
      <section className="flex min-w-0 flex-col gap-4">
        <nav aria-label="投稿状态" className="flex flex-wrap gap-2">
          {TABS.map((entry) => {
            const active = entry.id === tab;
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setTab(entry.id)}
                /*
                  Split into a shared base plus a state half, the way
                  EventSubmitPage already writes the same pill, so the two
                  copies in this feature read as one control.

                  The pill itself is left at `text-sm`: it is a control, not
                  prose, and 14px is what every filter pill in the app uses —
                  FollowListPage carries this exact class list verbatim. Only
                  the type steps of prose converged in batch 07.

                  What it was missing is `focus-ring` and `transition-colors`:
                  it is a button, and a button that can be tabbed to has to
                  show where the focus went.
                */
                className={cn(
                  "focus-ring rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-accent bg-accent/10 font-medium text-accent-strong"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {entry.label}
                {counts[entry.id] > 0 ? (
                  /* 11px, not 13: the label beside it is 14px, and a count one
                     pixel under its own label is not a count, it is a smudge. */
                  <span className="ml-1 text-[11px]">{counts[entry.id]}</span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <PageState
            kind="empty"
            title="还没有参与活动"
            description="在活动页提交自己的作品后，进度会显示在这里。"
          />
        ) : visible.length === 0 ? (
          <PageState
            kind="empty"
            title={`没有${TABS.find((entry) => entry.id === tab)?.label}的投稿`}
            description="切到其它分类查看你的投稿记录。"
          />
        ) : (
          /*
            One stream of rows, not a grid of cards — see note 1 at the top of
            this file. `FeedRow` owns the hairline (`border-b` + `last:border-b-0`)
            and the row padding, so the <ul> must NOT add `divide-y`: the same
            edge drawn twice is the defect this batch removes.

            `key={tab}` is the whole replay mechanism. A new key unmounts the
            <ul>, so the rows animate in again for the bucket the reader just
            asked for; without it the old rows would simply be replaced, and a
            filter that swaps content with no motion reads as a filter that did
            nothing. The delays are inline because `animate-rise-in` is the
            `animation` shorthand and resets `animation-delay` (stagger.ts).
          */
          <ul aria-label="投稿记录" key={tab} className="flex flex-col">
            {visible.map(({ submission, event }, index) => (
              <FeedRow
                key={submission.id}
                className="animate-rise-in"
                style={{ animationDelay: staggerDelay(index) }}
                /*
                  The trailing slot is the one action on the row, so it sits on
                  the row's own trailing edge instead of inside the text block —
                  the same place the plaza card puts 「查看活动」. An orphaned
                  submission has no target, so it gets a statement, not a button:
                  a disabled-looking link would promise a page that does not
                  exist.
                */
                meta={
                  event ? (
                    <Link
                      to={`/events/${encodeURIComponent(event.id)}`}
                      className="focus-ring shrink-0 rounded-md border border-input px-3 py-1.5 text-meta text-foreground transition-colors hover:bg-surface-sunken"
                    >
                      查看活动
                    </Link>
                  ) : (
                    <span className="text-meta text-muted-foreground">活动已不在开放列表</span>
                  )
                }
              >
                {/* 列表项标题走 h3（B §1：行主标题），页头是唯一的 h1。 */}
                <h3 className="truncate text-h3 text-primary">
                  {submission.objectTitle?.trim() || "未命名作品"}
                </h3>
                {/* One line, two steps on purpose: the chip is a badge and
                    keeps 11px, the status words are prose and rose to
                    `text-meta` with the rest of the domain. */}
                <p className="mt-1 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                  <span className="rounded-chip border border-border px-1 text-[11px]">
                    {SUBMISSION_OBJECT_LABELS[submission.objectType] ?? submission.objectType}
                  </span>
                  <span>{submissionStatusLabel(submission.status)}</span>
                  <span>{isSubmissionSettled(submission.status) ? "已审核" : "审核中"}</span>
                </p>

                {/* The event title is the row's context; without the event in
                    the active list there is nothing honest to put here. */}
                {event ? (
                  <p className="mt-1 flex items-center gap-1.5 text-meta text-muted-foreground">
                    {isEventEnded(event) === true ? (
                      <span className="shrink-0 rounded-chip border border-border px-1 text-[11px]">
                        已结束
                      </span>
                    ) : null}
                    <span className="truncate">{event.title}</span>
                  </p>
                ) : null}

                {submission.note?.trim() ? (
                  <p className="mt-1 text-meta text-muted-foreground">{submission.note}</p>
                ) : null}
              </FeedRow>
            ))}
          </ul>
        )}
      </section>
    </ArchetypeFrame>
  );
}

/**
 * 右栏三块，全部由本页已取回的数据派生（`rows` / `activeEvents`）。
 *
 * 刻意没有「已报名人数 / 剩余名额 / 通过率」：`EventView` 契约里没有 capacity，
 * 公开活动列表也不返回报名数，编一个数字就是假数据。这里的四个数字与每条推荐
 * 都能从 props 逐条复核。
 */
function MyEventsRail({
  rows,
  activeEvents,
  recommendations,
}: {
  rows: Row[];
  activeEvents: EventView[];
  recommendations: EventView[];
}) {
  const distinctEvents = new Set(rows.map((row) => row.submission.eventId)).size;
  const openEvents = activeEvents.filter((event) => isEventEnded(event) !== true).length;
  const latestDay = formatEventDay(latestSubmissionAt(rows));

  return (
    <div className="flex flex-col gap-4">
      {/*
        概览只在真有投稿时出现：空态下它只能复述「0 条」，与空态文案重复，还会
        让加载完成时多一次布局跳动（书架页同一条判据）。
      */}
      {rows.length > 0 ? (
        <section
          aria-labelledby="my-events-rail-overview"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="my-events-rail-overview" className="text-h3 text-primary">
            投稿概览
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-caption text-muted-foreground">投稿总数</dt>
              <dd className="mt-1 text-title font-semibold tabular-nums text-primary">
                {rows.length}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">涉及活动</dt>
              <dd className="mt-1 text-title font-semibold tabular-nums text-primary">
                {distinctEvents}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">进行中活动</dt>
              <dd className="mt-1 text-title font-semibold tabular-nums text-primary">
                {openEvents}
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">最近投稿</dt>
              <dd className="mt-1 text-meta text-foreground-soft">{latestDay ?? "暂无记录"}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section
        aria-labelledby="my-events-rail-recommend"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="my-events-rail-recommend" className="flex items-center gap-1.5 text-h3 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          推荐活动
        </h2>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-meta text-muted-foreground">
            {rows.length === 0 ? "暂无可推荐活动。" : "你已经参与了所有进行中的活动。"}
          </p>
        ) : (
          /*
            The same rail row language as `/events`'s "即将开始" list: the
            same three type steps, the same `hover:bg-muted` on the row and
            the same `focus-ring` + `transition-colors` pair, so one event
            link in a 300px rail looks the same whichever rail you meet it
            in. Three `text-meta` lines told apart by weight and colour rather
            than a fourth type step is the argument written out in full at
            EventsPage.tsx.
          */
          <ul className="mt-3 flex flex-col gap-2">
            {recommendations.map((event) => (
              <li key={event.id}>
                <Link
                  to={`/events/${encodeURIComponent(event.id)}`}
                  className="focus-ring block rounded-md p-1.5 transition-colors hover:bg-muted"
                >
                  <span className="block truncate text-meta font-medium text-foreground">
                    {event.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-meta text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    {event.startsAt ? formatEventDay(event.startsAt) : "时间待定"}
                    <span className="ml-1">
                      {event.submissionOpen ? "征集进行中" : "暂未开放投稿"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="my-events-rail-note"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="my-events-rail-note" className="flex items-center gap-1.5 text-h3 text-primary">
          <Clock3 className="h-4 w-4" aria-hidden />
          说明
        </h2>
        <p className="mt-2 text-meta text-muted-foreground">
          投稿需要经过活动方审核，通过后会公示在活动页。取消报名不会移除已提交的投稿。
        </p>
      </section>
    </div>
  );
}

/**
 * 最近一次投稿的时间戳；缺失或不可解析的 createdAt 直接跳过。
 * 返回原始 ISO 串而不是格式化结果，日期的呈现交给 `formatEventDay`（CST）。
 */
function latestSubmissionAt(rows: Row[]): string | null {
  let latestMs = 0;
  let latestRaw: string | null = null;
  for (const row of rows) {
    const raw = row.submission.createdAt;
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isNaN(ms) || ms <= latestMs) continue;
    latestMs = ms;
    latestRaw = raw;
  }
  return latestRaw;
}
