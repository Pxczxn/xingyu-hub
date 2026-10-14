import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock3, FileText } from "lucide-react";
import { ApiError } from "@/api/client";
import { articlesApi } from "@/api/articles/articles.api";
import { eventsApi } from "@/api/events/events.api";
import {
  SUBMISSION_OBJECT_TYPES,
  submittableArticles,
  submittableMoments,
  submittableSeries,
  type SubmissionOption,
} from "@/api/events/events.picker";
import {
  SUBMISSION_OBJECT_LABELS,
  formatEventDateTime,
  isEventEnded,
  type EventView,
  type SubmissionObjectType,
} from "@/api/events/events.types";
import { momentsApi } from "@/api/moments/moments.api";
import { seriesApi } from "@/api/series/series.api";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/*
 * Submit a piece of your content to an event (Phase 2I-4).
 *
 * THE FILTER IS THE FEATURE. `POST /me/events/{id}/submissions` 404s with
 * 「投稿内容不存在」 for anything not in `search_document`, and only published
 * content is indexed — so a draft article is rejected with a message that blames
 * the wrong thing. `events.picker.ts` therefore narrows each source list to what
 * can actually succeed, and this page is a thin shell over it. If a type has no
 * eligible content the page SAYS SO instead of showing an empty dropdown.
 *
 * Only the selected type's list is fetched: loading all three at once would
 * triple the requests to render two lists the user may never open. Switching
 * tabs fetches on demand.
 *
 * A successful submit returns to the event rather than rendering a success card:
 * the event page already shows the submission list and the flow's third step,
 * and a separate confirmation screen would be a surface with no content of its
 * own.
 *
 * 2026-10-13 (batch 07b). The domain-wide surface rules live at the top of
 * EventsPage.tsx. Three things are specific to this page, because this is the
 * one page in the domain that is a FORM rather than a list:
 *
 *   1. THE FORM DOES NOT STAGGER. `AppLayout` already plays `animate-page-enter`
 *      on every route change; a second entrance stacked on two fixed cards would
 *      only make the form slower to become usable, and a form is the one surface
 *      where "slower to become usable" is the whole cost. The single exception is
 *      the preview card in the rail — it is not a fixed block, it appears and
 *      changes with the reader's selection, so motion there is feedback rather
 *      than decoration.
 *
 *   2. CONTROLS KEEP THE CONTROL STEP. Batch 07 converged this domain's prose on
 *      `text-meta`, but a form label is not prose: `labelVariants` is
 *      `text-sm font-medium`, and CollaborationInvitePage — the other hand-written
 *      form in the app — sets its label at exactly that step in `text-foreground`.
 *      This page had its label at 12px in `text-muted-foreground`, i.e. a name
 *      smaller and fainter than the control it names. The character counter follows
 *      the same file's `text-xs` rather than rising to `text-meta`: it is a live
 *      readout beside an input, not a sentence.
 *
 *   3. A FIELD-LEVEL NOTE AND A FORM-LEVEL RESULT ARE NOT THE SAME RANK. The three
 *      states around the picker (loading, load failure, nothing eligible) are notes
 *      about one control and sit at `text-meta` with the rest of the domain. The
 *      submit failure is the outcome of the whole form and stays at `text-sm`,
 *      the rank EventDetailPage's page-level alert uses.
 */

type EventState =
  | { kind: "loading" }
  | { kind: "error"; detail: string | null; notFound: boolean }
  | { kind: "ready"; event: EventView };

type OptionsState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; detail: string | null }
  | { kind: "ready"; options: SubmissionOption[] };

const NOTE_MAX = 500;

export function EventSubmitPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [eventState, setEventState] = useState<EventState>({ kind: "loading" });
  const [objectType, setObjectType] = useState<SubmissionObjectType>("ARTICLE");
  const [optionsState, setOptionsState] = useState<OptionsState>({ kind: "idle" });
  const [objectId, setObjectId] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /* Bumping the key replays the event-load effect — the retry mechanism for
     the error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setEventState({ kind: "loading" });
    eventsApi
      .get(eventId)
      .then((event) => {
        if (active) setEventState({ kind: "ready", event });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setEventState({
          kind: "error",
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
          notFound: err instanceof ApiError && err.problem.status === 404,
        });
      });
    return () => {
      active = false;
    };
  }, [eventId, reloadKey]);

  // Load only the eligible content for the active tab.
  useEffect(() => {
    let active = true;
    setOptionsState({ kind: "loading" });
    setObjectId("");

    const load: Promise<SubmissionOption[]> =
      objectType === "ARTICLE"
        ? articlesApi.listMine().then(submittableArticles)
        : objectType === "SERIES"
          ? seriesApi.listMine().then(submittableSeries)
          : momentsApi.listMine().then(submittableMoments);

    load
      .then((options) => {
        if (!active) return;
        setOptionsState({ kind: "ready", options });
        // Preselect on each tab switch so the common case is one click.
        setObjectId(options[0]?.objectId ?? "");
      })
      .catch((err: unknown) => {
        if (!active) return;
        setOptionsState({
          kind: "error",
          detail: err instanceof ApiError && err.problem.detail ? err.problem.detail : null,
        });
      });

    return () => {
      active = false;
    };
  }, [objectType]);

  const options = optionsState.kind === "ready" ? optionsState.options : [];
  const selected = useMemo(
    () => options.find((option) => option.objectId === objectId),
    [objectId, options],
  );

  const event = eventState.kind === "ready" ? eventState.event : null;
  const ended = event ? isEventEnded(event) === true : false;
  const submissionsClosed = Boolean(event && (!event.submissionOpen || ended));
  const canSubmit = Boolean(event) && !submissionsClosed && Boolean(objectId) && !submitting;

  async function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!eventId || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await eventsApi.submit(eventId, {
        objectType,
        objectId,
        // Omitted entirely when blank — an empty note is not a note.
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      navigate(`/events/${encodeURIComponent(eventId)}`);
    } catch (err: unknown) {
      // The server's own wording, which is load-bearing here: 「投稿内容不存在」
      // is the message a draft produces, and the user needs to see that rather
      // than a generic failure.
      setSubmitError(
        err instanceof ApiError && err.problem.detail
          ? err.problem.detail
          : "投稿失败，请确认内容已发布后重试。",
      );
      setSubmitting(false);
    }
  }

  if (!eventId) {
    return <PageState kind="error" title="活动不存在" description="缺少活动标识。" />;
  }

  if (eventState.kind === "loading") return <PageState kind="loading" />;

  if (eventState.kind === "error") {
    return (
      <div className="section-gap">
        <PageState
          kind="error"
          title={eventState.notFound ? "活动不存在" : "活动加载失败"}
          description={
            eventState.notFound
              ? "这个活动不存在，或者已经下线。"
              : (eventState.detail ?? "无法读取活动信息，请稍后重试。")
          }
        />
        {/* Retry only when the read itself failed — a 404 has nothing to
            re-read. */}
        {!eventState.notFound ? (
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

  const { event: loaded } = eventState;

  return (
    <div className="section-gap">
      <nav className="text-sm">
        <Link
          to={`/events/${encodeURIComponent(eventId)}`}
          className="text-accent-strong hover:underline"
        >
          返回活动
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">活动投稿</h1>
        <p className="text-sm text-muted-foreground">{loaded.title}</p>
      </header>

      {submissionsClosed ? (
        <PageState
          kind="error"
          title="投稿通道未开放"
          description={
            ended ? "这个活动已经结束，无法再投稿。" : "这个活动当前未开放投稿，请稍后再来。"
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          {/* The numbered steps are the same kind of block as each other, so the
              tight rhythm; `section-gap` would open a hole between them. */}
          <form onSubmit={onSubmit} className="section-gap-tight">
            <section className="rounded-xl border border-border/70 bg-card p-5">
              <h2 className="section-heading">1. 选择投稿内容</h2>

              <nav aria-label="投稿类型" className="mt-3 flex flex-wrap gap-2">
                {SUBMISSION_OBJECT_TYPES.map((type) => {
                  const active = type === objectType;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setObjectType(type)}
                      /* The same pill as MyEventsPage's status filter, which is
                         the same pill FollowListPage carries verbatim. It was
                         missing the focus ring; a button that can be tabbed to
                         has to show where the focus went. */
                      className={cn(
                        "focus-ring rounded-md border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-accent bg-accent/10 font-medium text-accent-strong"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {SUBMISSION_OBJECT_LABELS[type]}
                    </button>
                  );
                })}
              </nav>

              {optionsState.kind === "loading" ? (
                <p className="mt-3 text-meta text-muted-foreground">正在加载可选内容…</p>
              ) : optionsState.kind === "error" ? (
                <p role="alert" className="mt-3 text-meta text-destructive">
                  {optionsState.detail ?? "无法加载你的内容，请稍后重试。"}
                </p>
              ) : options.length === 0 ? (
                // An empty dropdown would look like a bug. Say why there is
                // nothing, and what to do about it.
                <p className="mt-3 text-meta text-muted-foreground">
                  {objectType === "ARTICLE"
                    ? "没有可投稿的文章。只有已发布的文章可以投稿，草稿和审核中的文章不在范围内。"
                    : objectType === "SERIES"
                      ? "没有可投稿的系列。只有进行中的系列可以投稿。"
                      : "还没有可投稿的动态。发布一条动态后就可以投稿了。"}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  {/* The label names the control, so it takes the control step
                      (`labelVariants`, and CollaborationInvitePage's own form):
                      14px, medium, full-strength text. At 12px in
                      `text-muted-foreground` it was quieter than the select it
                      labels, which is backwards — the reader needs to know what
                      they are choosing before they can care about the options. */}
                  <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
                    选择已发布的作品
                    <select
                      aria-label="选择投稿内容"
                      value={objectId}
                      onChange={(e) => setObjectId(e.target.value)}
                      /* The textarea below already carried a focus ring; the
                         select did not, so half the form told a keyboard user
                         where they were and half did not. Same ring, same step. */
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {options.map((option) => (
                        <option value={option.objectId} key={option.objectId}>
                          {option.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="flex items-start gap-1.5 text-meta text-muted-foreground">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    投稿以作品的原始内容为准，不会修改你的作品。
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border/70 bg-card p-5">
              <h2 className="section-heading">2. 投稿说明</h2>
              <p className="mt-1 text-meta text-muted-foreground">
                可简要说明创作思路，选填，最多 {NOTE_MAX} 字。
              </p>
              <textarea
                value={note}
                aria-label="投稿说明"
                rows={4}
                maxLength={NOTE_MAX}
                placeholder="写下你的投稿说明（选填）"
                onChange={(e) => setNote(e.target.value)}
                className="mt-3 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {/* `text-xs`, not `text-meta`: this is the live readout beside an
                  input, the same element CollaborationInvitePage renders under
                  its note field at this same step. It was at 10px — under the
                  11px micro step that is the app's own floor — which is smaller
                  than anything else on any surface in this domain. */}
              <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
                {note.length}/{NOTE_MAX}
              </p>
            </section>

            {submitError ? (
              /* The outcome of the whole form, so it keeps `text-sm` — the rank
                 EventDetailPage's page-level alert uses. The notes around the
                 picker are about one control and sit at `text-meta`; this one is
                 about the submit itself. */
              <p role="alert" className="text-sm text-destructive">
                {submitError}
              </p>
            ) : null}

            <footer className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="accent" disabled={!canSubmit}>
                {submitting ? "提交中…" : "提交投稿"}
              </Button>
              <Link
                to={`/events/${encodeURIComponent(eventId)}`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                取消
              </Link>
              {!objectId && options.length > 0 ? (
                <span className="text-meta text-muted-foreground">请先选择一个作品。</span>
              ) : null}
            </footer>
          </form>

          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="section-heading">{loaded.title}</h2>
              <p className="mt-2 flex items-center gap-1 text-meta text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {loaded.startsAt
                  ? `开始 ${formatEventDateTime(loaded.startsAt)}`
                  : "开始时间待公布"}
              </p>
              <p className="mt-1 text-meta text-muted-foreground">
                结束 {formatEventDateTime(loaded.endsAt) ?? "待公布"}
              </p>
            </section>

            {selected ? (
              /*
                The one animated block on this page, and the only one that earns
                it: it is not a fixed card, it appears with the first selection
                and is REPLACED every time the reader picks a different work.
                `key={selected.objectId}` is the whole mechanism — a new key
                unmounts the card, so the title it now shows rises in instead of
                silently swapping. Without it a dropdown change and a preview
                that changed would be two events with no visible connection.

                260ms (tailwind.config.ts) and no delay: this is a single card
                answering one click, not a list arriving.
              */
              <section
                key={selected.objectId}
                className="animate-rise-in rounded-xl border border-border/70 bg-card p-4"
              >
                <h2 className="section-heading">作品预览</h2>
                <p className="mt-2 text-meta font-medium text-foreground">{selected.title}</p>
                <p className="mt-0.5 text-meta text-muted-foreground">
                  内容类型：{SUBMISSION_OBJECT_LABELS[selected.objectType] ?? selected.objectType}
                </p>
              </section>
            ) : null}

            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="section-heading">投稿须知</h2>
              <p className="mt-2 text-meta text-muted-foreground">
                只能提交自己已发布的内容。投稿后需要经过审核，通过后才会在活动页公示。
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
