import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, Sparkles } from "lucide-react";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import {
  SUBMISSION_OBJECT_LABELS,
  formatEventDay,
  isSubmissionSettled,
  submissionStatusLabel,
  type EventSubmissionView,
  type EventView,
} from "@/api/events/events.types";
import { PageState } from "@/components/shared/PageState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
  }, []);

  const rows = state.kind === "ready" ? state.rows : [];

  const counts = useMemo(() => {
    const result: Record<Bucket, number> = { pending: 0, accepted: 0, rejected: 0 };
    for (const row of rows) result[bucketOf(row.submission.status)] += 1;
    return result;
  }, [rows]);

  // Recommendations: active events the user has never submitted to. Joined on
  // eventId, which is the only key a submission carries.
  const recommendations = useMemo(() => {
    if (state.kind !== "ready") return [];
    const joined = new Set(state.rows.map((row) => row.submission.eventId));
    return state.activeEvents.filter((event) => !joined.has(event.id)).slice(0, 5);
  }, [state]);

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
            <Link to="/login" className="text-sm text-accent hover:underline">
              去登录
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  const visible = rows.filter((row) => bucketOf(row.submission.status) === tab);

  return (
    <div className="section-gap">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">我的活动</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length > 0 ? `共参与 ${rows.length} 项活动投稿` : "还没有活动投稿记录"}
          </p>
        </div>
        <Link to="/events" className={cn(buttonVariants({ variant: "outline" }))}>
          浏览活动
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="flex flex-col gap-4">
          <nav aria-label="投稿状态" className="flex flex-wrap gap-2">
            {TABS.map((entry) => {
              const active = entry.id === tab;
              return (
                <button
                  key={entry.id}
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => setTab(entry.id)}
                  className={
                    active
                      ? "rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                      : "rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  }
                >
                  {entry.label}
                  {counts[entry.id] > 0 ? (
                    <span className="ml-1 text-xs">{counts[entry.id]}</span>
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
            <ul aria-label="投稿记录" className="flex flex-col gap-3">
              {visible.map(({ submission, event }) => (
                <li
                  key={submission.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {submission.objectTitle?.trim() || "未命名作品"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded border border-border px-1">
                          {SUBMISSION_OBJECT_LABELS[submission.objectType] ?? submission.objectType}
                        </span>
                        <span>{submissionStatusLabel(submission.status)}</span>
                        <span>{isSubmissionSettled(submission.status) ? "已审核" : "审核中"}</span>
                      </p>
                    </div>
                    {event ? (
                      <Link
                        to={`/events/${encodeURIComponent(event.id)}`}
                        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
                      >
                        查看活动
                      </Link>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        活动已不在开放列表
                      </span>
                    )}
                  </div>

                  {/* The event title is the row's context; without the event in
                      the active list there is nothing honest to put here. */}
                  {event ? <p className="text-xs text-muted-foreground">{event.title}</p> : null}

                  {submission.note?.trim() ? (
                    <p className="text-xs text-muted-foreground">{submission.note}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4" aria-hidden />
              推荐活动
            </h2>
            {recommendations.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {rows.length === 0 ? "暂无可推荐活动。" : "你已经参与了所有进行中的活动。"}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {recommendations.map((event) => (
                  <li key={event.id}>
                    <Link
                      to={`/events/${encodeURIComponent(event.id)}`}
                      className="block rounded-md p-1.5 hover:bg-muted"
                    >
                      <span className="block truncate text-xs font-medium text-foreground">
                        {event.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" aria-hidden />
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

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Clock3 className="h-4 w-4" aria-hidden />
              说明
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              投稿需要经过活动方审核，通过后会公示在活动页。取消报名不会移除已提交的投稿。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
