import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  PenLine,
  Sparkles,
  UsersRound,
} from "lucide-react";
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
import { ArchetypeFrame } from "@/components/layout";
import { PageMasthead } from "@/components/shared/PageMasthead";
import { PageState } from "@/components/shared/PageState";
import { EventDateBlock } from "../components/EventDateBlock";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { staggerDelay } from "@/lib/stagger";
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
 *
 * 2026-11-10（批次 W1）—— 骨架按 A §3 的 EventDetail 行取 SK1 · 线/松/错：
 *
 *   1. `skeleton="SK1"` + 传 `rail` ⇒ `lg:[measure | 220px]`，右轨由 `SectionRail`
 *      粘住 —— 这就是 R=**错**（主列 + 侧轨）。右轨放「参与方式」与「投稿须知」，
 *      它们是读正文之前/之后要对照的规则，不是正文的一部分。
 *   2. `header="line"` ⇒ H=**线**：`PageMasthead`（无面 masthead，标题贴内容列
 *      左缘，动作在基线尾）。原来手写的 `<h1 className="text-2xl …">` 就此收敛，
 *      页面仍只有这一个 h1。NO BANNER，也不用 `PageHero`：那不是广场页。
 *   3. `density="loose"` ⇒ D=**松**：活动说明与活动投稿各是独立卡面。
 *
 * 与 EventsPage（SK2·幅/紧/错）同域相邻但四元组不同：那页是横幅 + 行流，
 * 本页是线 masthead + 独立卡面 + 阅读尺宽的主列。
 *
 * 2026-10-13 (batch 07b). The surface and type rules this domain follows are
 * stated once at the top of EventsPage.tsx; only what is specific to this page
 * is repeated here:
 *
 *   1. NO BANNER, and no `PageHero`. This is a single event reached from the
 *      plaza, not a landing surface.
 *   2. NESTED SURFACES KEEP FULL-STRENGTH BORDERS. The cards are
 *      `rounded-card border border-border/70 bg-card`; the submission rows inside
 *      the second one stay `rounded-md border border-border`. The 70% frame is
 *      for the edge of a surface, not for a divider between two things that are
 *      both already on screen.
 *   3. A CHIP STAYS AT 11px EVEN WHEN ITS LINE GOES TO 13px.
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [eventId, reloadKey]);

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
        {/* Retry only when the read itself failed — a 404 has nothing to
            re-read. */}
        {!state.notFound ? (
          <div className="text-center">
            <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
              重新加载
            </Button>
          </div>
        ) : null}
        <p className="text-center">
          <Link to="/events" className="text-sm text-accent-strong hover:underline">
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
    <ArchetypeFrame
      skeleton="SK1"
      header="line"
      density="loose"
      rail={<EventDetailRail event={event} ended={ended} canSubmit={canSubmit} />}
      /* landmark 名与右轨里两块卡的标题（参与方式 / 投稿须知）都不同名。 */
      railLabel="活动侧栏"
      headerSlot={
        <div className="flex flex-col gap-4">
          <Link
            to="/events"
            className="focus-ring self-start rounded-sm text-meta text-accent-strong hover:underline"
          >
            返回活动广场
          </Link>

          {/*
            H=线：标题是页面唯一的 h1，动作挂在同一条阅读线的尾端（`PageMasthead`
            的 actions 槽），描述就是活动说明——它既是「这是什么活动」，也是正文
            之前的 lede，因此不再在正文里重复一遍。
          */}
          <PageMasthead
            eyebrow="社区活动"
            title={event.title}
            description={event.body?.trim() || "主办方暂未提供详细说明。"}
            actions={
              <>
                {canSubmit ? (
                  /*
                    `buttonVariants({ variant: "accent" })` instead of a
                    hand-written class string. The inline version carried no
                    height, so this link and the two real <Button>s sitting
                    beside it disagreed about how tall a control is — `h-9` is
                    the answer and it only comes from the variant. It also
                    brings the focus ring.
                  */
                  <Link
                    to={`/events/${encodeURIComponent(event.id)}/submit`}
                    className={cn(buttonVariants({ variant: "accent" }))}
                  >
                    提交作品
                  </Link>
                ) : null}

                {/* Registration is a separate action, and only meaningful for a
                    signed-in user on an event that has not ended. An ended event
                    keeps no write affordance at all — the server rejects it. */}
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
                    <Button
                      variant="outline"
                      disabled={registrationBusy}
                      onClick={() => void onRegister()}
                    >
                      {registrationBusy ? "处理中…" : "报名参加"}
                    </Button>
                  )
                ) : null}

                {/* 「登录后参与」is an invitation to act; an ended event must not
                    offer it, or it would imply the event is still joinable. */}
                {!isAuthenticated && !ended ? (
                  <Link
                    to={`/login?returnTo=${encodeURIComponent(`/events/${event.id}`)}`}
                    className={cn(buttonVariants({ variant: "outline" }))}
                  >
                    登录后参与
                  </Link>
                ) : null}
              </>
            }
          />

          {/*
            日期块 + 状态 + 时间窗：与广场行同一个 `EventDateBlock`，同一个理由
            （这是读者到达这一页要回答的第一个问题：还赶得上吗、要不要报名）。
            它原来是标题下一行 12px 灰字，在一张以「还能不能参加」为目的的页面上
            把那两个事实压成了最难读的东西。H=线 只是「页头没有面」，不是「页头
            没有信息」。
          */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <EventDateBlock startsAt={event.startsAt} size="large" muted={ended} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="self-start rounded border border-accent-line/60 bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-strong">
                {ended ? "已结束" : event.submissionOpen ? "开放投稿" : "暂未开放投稿"}
              </span>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-meta">
                <span className="flex items-center gap-1 text-foreground-soft">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {event.startsAt ? `开始：${formatEventDateTime(event.startsAt)}` : "开始时间待公布"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {countdown ? (
                    <span className="font-medium text-accent-strong">
                      距离结束 {countdown}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {ended ? "活动已结束" : "结束时间待公布"}
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>
      }
    >
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <section
        aria-labelledby="event-detail-info"
        className="rounded-card border border-border/70 bg-card p-5"
      >
        <h2 id="event-detail-info" className="section-heading flex items-center gap-1.5">
          <FileText className="h-4 w-4" aria-hidden />
          活动说明
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Meta label="开始时间" value={formatEventDateTime(event.startsAt) ?? "待公布"} />
          <Meta label="结束时间" value={formatEventDateTime(event.endsAt) ?? "待公布"} />
          <Meta
            label="投稿状态"
            value={ended ? "活动已结束" : event.submissionOpen ? "开放中" : "暂未开放投稿"}
          />
          <Meta label="参与方式" value="提交已发布的内容即可参与" />
        </dl>
      </section>

      <section
        aria-labelledby="event-detail-submissions"
        className="rounded-card border border-border/70 bg-card p-5"
      >
        <h2 id="event-detail-submissions" className="section-heading flex items-center gap-1.5">
          <PenLine className="h-4 w-4" aria-hidden />
          活动投稿
        </h2>
        {submissions.length === 0 ? (
          /*
            `text-meta`, matching the two empty-list lines on the plaza. They
            are the same thing — a sentence standing in for a list that has
            nothing in it — and they used to differ by one pixel, 14 here and
            13 there, which is the kind of gap nobody can name and everybody
            can see once the two pages are open side by side.
          */
          <p className="mt-3 text-meta text-muted-foreground">
            暂无通过审核的投稿。投稿需要经过审核后才会公示。
          </p>
        ) : (
          /*
            The rows rise in on their own delays, like the plaza lists. This
            list is the one block on the page whose length is not known ahead
            of time, so it is the one block where the stagger has something to
            say. The cards around it deliberately do NOT stagger: AppLayout
            already plays `animate-page-enter` on every route change.
          */
          <ul aria-label="投稿列表" className="mt-3 flex flex-col gap-2">
            {submissions.map((submission, index) => (
              <li
                key={submission.id}
                className="animate-rise-in flex items-start gap-3 rounded-md border border-border p-3"
                style={{ animationDelay: staggerDelay(index) }}
              >
                <span className="min-w-0 flex-1">
                  {/* `text-card`, the step the rest of the app uses for the
                      main text of a list row. */}
                  <span className="block truncate text-card font-semibold text-primary">
                    {submission.objectTitle?.trim() || "未命名作品"}
                  </span>
                  {/* One line, two steps on purpose: the chip is a badge and
                      keeps 11px, the status and the time are prose and sit at
                      `text-meta` with the rest of the domain. */}
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-meta text-muted-foreground">
                    <span className="rounded border border-border px-1 text-[11px]">
                      {SUBMISSION_OBJECT_LABELS[submission.objectType] ?? submission.objectType}
                    </span>
                    <span>{submissionStatusLabel(submission.status)}</span>
                    {formatEventDateTime(submission.createdAt) ? (
                      <time>{formatEventDateTime(submission.createdAt)}</time>
                    ) : null}
                  </span>
                  {submission.note?.trim() ? (
                    <span className="mt-1 block text-meta text-muted-foreground">
                      {submission.note}
                    </span>
                  ) : null}
                </span>
                {isSubmissionAccepted(submission.status) ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-accent-strong"
                    aria-label="已通过"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </ArchetypeFrame>
  );
}

/**
 * 右轨（R=错 的那条侧轨）：参与方式 + 投稿须知。
 *
 * 它只是一个**内容组件** —— 粘住、滚动与 landmark 由 `ArchetypeFrame` 里的
 * `SectionRail` 负责（`SectionRail.tsx:41-56`），所以这里没有再包一层 `<aside>`。
 *
 * 「投稿须知」只在对这个活动还能做出动作时出现：活动结束后它是一条无法执行的
 * 指令，因此整卡不渲染；「参与方式」则保留为历史记录（去掉祈使句、去掉投稿入口）。
 */
function EventDetailRail({
  event,
  ended,
  canSubmit,
}: {
  event: EventView;
  ended: boolean;
  canSubmit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="event-detail-rules"
        className="rounded-card border border-border/70 bg-card p-4"
      >
        <h2 id="event-detail-rules" className="section-heading flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" aria-hidden />
          {ended ? "参与方式（活动规则）" : "参与方式"}
        </h2>
        {/* Kept as the historical rule set for an ended event, but demoted
            from an instruction to a record: no imperative verbs, and no
            「去投稿」entry. */}
        <ol className="mt-3 flex list-none flex-col gap-2 p-0 text-meta text-muted-foreground">
          <li>1. 选择自己已发布的文章、系列或动态</li>
          <li>2. 填写投稿说明后提交</li>
          <li>3. 在「我的活动」查看投稿进度</li>
        </ol>
        {ended ? (
          <p className="mt-3 text-meta text-muted-foreground">
            活动已结束，以上为本次活动当时的参与规则。
          </p>
        ) : null}
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

      {/* An ended event has no submission rules that can still be acted on. */}
      {ended ? null : (
        <section
          aria-labelledby="event-detail-notice"
          className="rounded-card border border-border/70 bg-card p-4"
        >
          <h2 id="event-detail-notice" className="section-heading flex items-center gap-1.5">
            <UsersRound className="h-4 w-4" aria-hidden />
            投稿须知
          </h2>
          <p className="mt-2 text-meta text-muted-foreground">
            只能提交自己已发布的内容。草稿和审核中的文章不在可投稿范围内，投稿后原内容不会被修改。
          </p>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
      <dt className="text-meta text-muted-foreground">{label}</dt>
      <dd className="text-meta font-medium text-foreground">{value}</dd>
    </div>
  );
}
