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
  }, [eventId]);

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
        <p className="text-center">
          <Link to="/events" className="text-sm text-accent hover:underline">
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
        <Link to={`/events/${encodeURIComponent(eventId)}`} className="text-accent hover:underline">
          返回活动
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-primary">活动投稿</h1>
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
          <form onSubmit={onSubmit} className="flex flex-col gap-6">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">1. 选择投稿内容</h2>

              <nav aria-label="投稿类型" className="mt-3 flex flex-wrap gap-2">
                {SUBMISSION_OBJECT_TYPES.map((type) => {
                  const active = type === objectType;
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => setObjectType(type)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm",
                        active
                          ? "border-accent bg-accent/10 font-medium text-accent"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {SUBMISSION_OBJECT_LABELS[type]}
                    </button>
                  );
                })}
              </nav>

              {optionsState.kind === "loading" ? (
                <p className="mt-3 text-sm text-muted-foreground">正在加载可选内容…</p>
              ) : optionsState.kind === "error" ? (
                <p role="alert" className="mt-3 text-sm text-destructive">
                  {optionsState.detail ?? "无法加载你的内容，请稍后重试。"}
                </p>
              ) : options.length === 0 ? (
                // An empty dropdown would look like a bug. Say why there is
                // nothing, and what to do about it.
                <p className="mt-3 text-sm text-muted-foreground">
                  {objectType === "ARTICLE"
                    ? "没有可投稿的文章。只有已发布的文章可以投稿，草稿和审核中的文章不在范围内。"
                    : objectType === "SERIES"
                      ? "没有可投稿的系列。只有进行中的系列可以投稿。"
                      : "还没有可投稿的动态。发布一条动态后就可以投稿了。"}
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    选择已发布的作品
                    <select
                      aria-label="选择投稿内容"
                      value={objectId}
                      onChange={(e) => setObjectId(e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                    >
                      {options.map((option) => (
                        <option value={option.objectId} key={option.objectId}>
                          {option.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    投稿以作品的原始内容为准，不会修改你的作品。
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground">2. 投稿说明</h2>
              <p className="mt-1 text-xs text-muted-foreground">
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
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                {note.length}/{NOTE_MAX}
              </p>
            </section>

            {submitError ? (
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
                <span className="text-xs text-muted-foreground">请先选择一个作品。</span>
              ) : null}
            </footer>
          </form>

          <aside className="flex flex-col gap-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">{loaded.title}</h2>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                {loaded.startsAt ? `开始 ${formatEventDateTime(loaded.startsAt)}` : "开始时间待公布"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                结束 {formatEventDateTime(loaded.endsAt) ?? "待公布"}
              </p>
            </section>

            {selected ? (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">作品预览</h2>
                <p className="mt-2 text-xs font-medium text-foreground">{selected.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  内容类型：{SUBMISSION_OBJECT_LABELS[selected.objectType] ?? selected.objectType}
                </p>
              </section>
            ) : null}

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">投稿须知</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                只能提交自己已发布的内容。投稿后需要经过审核，通过后才会在活动页公示。
              </p>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
