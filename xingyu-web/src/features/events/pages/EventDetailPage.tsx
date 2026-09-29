import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarClock, CheckCircle2, Clock3, FileText, PenLine, Sparkles, UsersRound } from "lucide-react";
import { ApiError } from "@/api/client";
import { eventsApi } from "@/api/events/events.api";
import {
  SUBMISSION_OBJECT_LABELS,
  eventCountdown,
  formatEventDateTime,
  isEventEnded,
  isSubmissionAccepted,
  submissionStatusLabel,
  type EventSubmissionView,
  type EventView,
} from "@/api/events/events.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/auth.store";

/*
 * One event (Phase 2I-4).
 *
 * Registration and submission are TWO SEPARATE THINGS on the backend and are
 * shown as two separate actions:
 *   POST /me/events/{id}/register      — "I intend to take part"
 *   POST /me/events/{id}/submissions   — "here is my work"
 * Registering does not submit and submitting does not register, so a UI that
 * merged them into one button would be lying about what happened.
 *
 * Registration state is readable only through the session (there is no
 * "am I registered" endpoint), so this page does NOT claim to know it on first
 * paint. It tracks what the user did in this visit and otherwise shows a neutral
 * 报名参加. A cancelled registration left in a previous session reads as "not
 * registered here" — which is the same thing the button would do if pressed, so
 * the worst case is one redundant idempotent POST, not a wrong claim.
 *
 * The public submission list is ACCEPTED-ONLY. An empty list says nothing about
 * whether anyone submitted, so the copy says 「暂无通过审核的投稿」 rather than
 * 「还没有人投稿」.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; detail: string | null; notFound: boolean }
  | { kind: "ready"; event: EventView; submissions: EventSubmissionView[] };

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setState({ kind: "loading" });
    setActionError(null);
    setRegistered(null);

    Promise.all([
      eventsApi.get(eventId),
      // A missing submission list must not sink the page: the event itself is
      // the point, and the list is decoration on top of it.
      eventsApi.listAcceptedSubmissions(eventId).catch(() => [] as EventSubmissionView[]),
    ])
      .then(([event, submissions]) => {
        if (active) setState({ kind: "ready", event, submissions });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setState({
          kind: "error",
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
          notFound: err instanceof ApiError && err.problem.status === 404,
        });
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const onRegister = useCallback(async () => {
    if (!eventId || registrationBusy) return;
    setRegistrationBusy(true);
    setActionError(null);
    try {
      const result = await eventsApi.register(eventId);
      // The server returns the row it ended up with, so report that rather than
      // assuming REGISTERED.
      setRegistered(result.status === "REGISTERED");
    } catch (err: unknown) {
      setActionError(err instanceof ApiError ? err.problem.detail : "报名失败，请稍后重试。");
    } finally {
      setRegistrationBusy(false);
    }
  }, [eventId, registrationBusy]);

  const onCancelRegistration = useCallback(async () => {
    if (!eventId || registrationBusy) return;
    setRegistrationBusy(true);
    setActionError(null);
    try {
      await eventsApi.cancelRegistration(eventId);
      setRegistered(false);
    } catch (err: unknown) {
      // 404 means there was nothing to cancel — that IS the state we wanted, so
      // it is not an error worth a banner. Anything else is.
      if (err instanceof ApiError && err.problem.status === 404) {
        setRegistered(false);
      } else {
        setActionError(err instanceof ApiError ? err.problem.detail : "取消报名失败，请稍后重试。");
      }
    } finally {
      setRegistrationBusy(false);
    }
  }, [eventId, registrationBusy]);

  if (!eventId) {
    return <PageState kind="error" title="活动不存在" description="缺少活动标识。" />;
  }

  if (state.kind === "loading") return <PageState kind="loading" />;

  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={state.notFound ? "活动不存在" : "活动加载失败"}
          description={
            state.notFound
              ? "这个活动不存在，或者已经下线。"
              : (state.detail ?? "无法读取活动详情，请稍后重试。")
          }
        />
        <p className="text-center">
          <Link to="/events" className="text-sm text-accent hover:underline">
            返回活动广场
          </Link>
        </p>
      </div>
    );
  }

  const { event, submissions } = state;
  const ended = isEventEnded(event) === true;
  const countdown = eventCountdown(event);
  const canSubmit = event.submissionOpen && !ended;

  return (
    <div className="section-gap">
      <nav className="text-sm">
        <Link to="/events" className="text-accent hover:underline">
          返回活动广场
        </Link>
      </nav>

      <header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {ended ? "已结束" : event.submissionOpen ? "开放投稿" : "暂未开放投稿"}
          </span>
          <span className="text-xs text-muted-foreground">社区活动</span>
        </div>
        <h1 className="text-xl font-semibold text-primary">{event.title}</h1>
        {event.body?.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{event.body}</p>
        ) : (
          <p className="text-sm text-muted-foreground">主办方暂未提供详细说明。</p>
        )}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {event.startsAt ? `开始：${formatEventDateTime(event.startsAt)}` : "开始时间待公布"}
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" aria-hidden />
            {countdown
              ? `距离结束 ${countdown}`
              : ended
                ? "活动已结束"
                : "结束时间待公布"}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {canSubmit ? (
            <Link
              to={`/events/${encodeURIComponent(event.id)}/submit`}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              提交作品
            </Link>
          ) : null}

          {/* Registration is a separate action, and only meaningful for a
              signed-in user on a running event. */}
          {isAuthenticated && !ended ? (
            registered ? (
              <Button
                variant="outline"
                disabled={registrationBusy}
                onClick={() => void onCancelRegistration()}
              >
                {registrationBusy ? "处理中…" : "已报名 · 取消报名"}
              </Button>
            ) : (
              <Button variant="outline" disabled={registrationBusy} onClick={() => void onRegister()}>
                {registrationBusy ? "处理中…" : "报名参加"}
              </Button>
            )
          ) : null}

          {!isAuthenticated ? (
            <Link
              to={`/login?returnTo=${encodeURIComponent(`/events/${event.id}`)}`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              登录后参与
            </Link>
          ) : null}
        </div>
      </header>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="flex flex-col gap-6">
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4" aria-hidden />
              活动说明
            </h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <Meta label="开始时间" value={formatEventDateTime(event.startsAt) ?? "待公布"} />
              <Meta label="结束时间" value={formatEventDateTime(event.endsAt) ?? "待公布"} />
              <Meta
                label="投稿状态"
                value={
                  ended ? "活动已结束" : event.submissionOpen ? "开放中" : "暂未开放投稿"
                }
              />
              <Meta label="参与方式" value="提交已发布的内容即可参与" />
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <PenLine className="h-4 w-4" aria-hidden />
              活动投稿
            </h2>
            {submissions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                暂无通过审核的投稿。投稿需要经过审核后才会公示。
              </p>
            ) : (
              <ul aria-label="投稿列表" className="mt-3 flex flex-col gap-2">
                {submissions.map((submission) => (
                  <li
                    key={submission.id}
                    className="flex items-start gap-3 rounded-md border border-border p-3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {submission.objectTitle?.trim() || "未命名作品"}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="rounded border border-border px-1">
                          {SUBMISSION_OBJECT_LABELS[submission.objectType] ?? submission.objectType}
                        </span>
                        <span>{submissionStatusLabel(submission.status)}</span>
                        {formatEventDateTime(submission.createdAt) ? (
                          <time>{formatEventDateTime(submission.createdAt)}</time>
                        ) : null}
                      </span>
                      {submission.note?.trim() ? (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {submission.note}
                        </span>
                      ) : null}
                    </span>
                    {isSubmissionAccepted(submission.status) ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-label="已通过" />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4" aria-hidden />
              参与方式
            </h2>
            <ol className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
              <li>1. 选择自己已发布的文章、系列或动态</li>
              <li>2. 填写投稿说明后提交</li>
              <li>3. 在「我的活动」查看投稿进度</li>
            </ol>
            <div className="mt-3 flex flex-col gap-2">
              {canSubmit ? (
                <Link
                  to={`/events/${encodeURIComponent(event.id)}/submit`}
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  去投稿
                </Link>
              ) : null}
              <Link to="/me/events" className={cn(buttonVariants({ variant: "ghost" }))}>
                我的活动
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <UsersRound className="h-4 w-4" aria-hidden />
              投稿须知
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              只能提交自己已发布的内容。草稿和审核中的文章不在可投稿范围内，投稿后原内容不会被修改。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xs font-medium text-foreground">{value}</dd>
    </div>
  );
}

