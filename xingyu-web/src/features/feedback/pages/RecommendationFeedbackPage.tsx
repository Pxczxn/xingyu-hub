import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, LoaderCircle, MessageSquareWarning } from "lucide-react";
import { ApiError } from "@/api/client";
import { recommendationFeedbackApi } from "@/api/recommendation-feedback/recommendation-feedback.api";
import type { RecommendationFeedback } from "@/api/recommendation-feedback/recommendation-feedback.types";
import {
  RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT,
  RECOMMENDATION_FEEDBACK_MAX_LENGTH,
} from "@/api/recommendation-feedback/recommendation-feedback.types";
import { PageState } from "@/components/shared/PageState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  FEEDBACK_SCOPE_NOTE,
  checkFeedbackBody,
  formatFeedbackTime,
  isJustSubmitted,
  prependFeedback,
  remainingChars,
} from "../recommendation-feedback";

/*
 * /feedback/recommendations — 推荐反馈 (Phase 3F)
 *
 * WHY THIS IS NOT A FAKE GAP: it reads AND writes real state
 * (`recommendation_feedback` rows keyed by user). Legacy's page is genuine; the
 * only thing to fix is that Legacy never said WHAT the feedback is about.
 *
 * ⚠️ THE SCOPE MUST BE STATED. `POST /me/recommendation-feedback` takes a single
 *   `{ body }` field — no rating, no target content id, no category. So this is
 *   free text about the RECOMMENDER AS A WHOLE. A user arriving from an article
 *   will naturally assume they are rating that article; the header says
 *   otherwise (see FEEDBACK_SCOPE_NOTE).
 *
 * ⚠️ THERE IS NO DELETE. The controller defines GET and POST only. So the page
 *   must NOT offer a delete control, and the copy warns before submitting that
 *   it cannot be undone — otherwise a user types a complaint, hits submit, and
 *   then hunts for a control that does not exist.
 *
 * ⚠️ THE LIST IS BARE AND CAPPED. `listMine` clamps limit to 1..50 and returns a
 *   plain array with NO cursor. Legacy requested 20 and rendered whatever came
 *   back; we do the same but say the real ceiling out loud instead of implying
 *   the archive is complete.
 *
 * The submitted row is prepended from the POST response rather than refetching —
 * the response IS the stored row. `isJustSubmitted` gates the confirmation so it
 * cannot claim the newest row is the user's after an unrelated reload.
 */

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; expired: boolean; detail: string | null }
  | { kind: "ready"; rows: RecommendationFeedback[] };

function isAuthError(err: unknown): boolean {
  return (
    err instanceof ApiError && (err.problem.status === 401 || err.problem.code === "AUTH_REQUIRED")
  );
}

export function RecommendationFeedbackPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<RecommendationFeedback | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitFailed, setSubmitFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    recommendationFeedbackApi
      .list()
      .then((rows) => {
        if (active) setState({ kind: "ready", rows });
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
              : (state.detail ?? "无法读取你的反馈记录，请稍后重试。")
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

  const handleSubmit = async () => {
    const checked = checkFeedbackBody(body);
    if (!checked.ok) {
      setFormError(checked.message);
      setSubmitFailed(false);
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setSubmitFailed(false);
    try {
      const entry = await recommendationFeedbackApi.submit(checked.body);
      setState((current) =>
        current.kind === "ready"
          ? { kind: "ready", rows: prependFeedback(current.rows, entry) }
          : { kind: "ready", rows: [entry] },
      );
      setJustSubmitted(entry);
      setBody("");
    } catch (err) {
      setSubmitFailed(true);
      setFormError(
        err instanceof ApiError && err.problem.detail ? err.problem.detail : "提交失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = remainingChars(body);
  const overLimit = remaining === 0 && body.trim().length > RECOMMENDATION_FEEDBACK_MAX_LENGTH;
  const confirmed = isJustSubmitted(justSubmitted, state.rows);

  return (
    <div className="section-gap">
      <header className="rounded-lg border border-border bg-card p-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-primary">
          <MessageSquareWarning className="h-5 w-5" aria-hidden />
          推荐反馈
        </h1>
        {/* Scope stated up front — otherwise users think they are rating an article. */}
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{FEEDBACK_SCOPE_NOTE}</p>
      </header>

      <section aria-label="提交反馈" className="rounded-lg border border-border bg-card p-5">
        <label htmlFor="feedback-body" className="text-sm font-medium text-foreground">
          反馈内容
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            setFormError(null);
            setSubmitFailed(false);
          }}
          rows={5}
          placeholder="例如：我更喜欢长文，希望少推荐短视频；或者某个领域的内容我不感兴趣。"
          aria-invalid={formError ? true : undefined}
          className={cn(
            "mt-2 w-full rounded-md border border-input bg-card p-3 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className={cn("text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}>
            还可输入 {remaining} 字
          </p>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !body.trim()}
          >
            {submitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                提交中…
              </>
            ) : (
              "提交反馈"
            )}
          </Button>
        </div>
        {formError ? (
          <p
            role={submitFailed ? "alert" : "alert"}
            className={cn("mt-2 text-sm", submitFailed ? "text-destructive" : "text-destructive")}
          >
            {formError}
          </p>
        ) : null}
        {confirmed ? (
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Check className="h-4 w-4" aria-hidden />
            已提交，感谢反馈
          </p>
        ) : null}
      </section>

      <section aria-label="历史反馈" className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="section-heading">历史反馈</h2>
          <span className="text-xs text-muted-foreground">{state.rows.length} 条</span>
        </div>

        {state.rows.length === 0 ? (
          <div className="p-5">
            <PageState
              kind="empty"
              title="还没有提交过反馈"
              description="提交后，你的反馈会显示在这里。"
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {state.rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm text-foreground">{row.body}</p>
                <time className="mt-1.5 block text-xs tabular-nums text-muted-foreground">
                  {formatFeedbackTime(row.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}

        {state.rows.length > 0 ? (
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            最多显示最近 {RECOMMENDATION_FEEDBACK_DEFAULT_LIMIT} 条，且无法删除或修改。
          </p>
        ) : null}
      </section>

      <p className="text-center">
        <Link to="/discover" className="text-sm text-accent hover:underline">
          去发现内容
        </Link>
      </p>
    </div>
  );
}
