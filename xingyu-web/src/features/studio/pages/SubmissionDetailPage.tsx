import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "@/api/client";
import { submissionsApi } from "@/api/submissions/submissions.api";
import type { ReviewSubmissionDetailView } from "@/api/submissions/submissions.types";
import {
  canWithdraw,
  submissionArticleHref,
  submissionFeedback,
  submissionStatusDescription,
  submissionStatusLabel,
  submissionTitle,
} from "@/api/submissions/submissions.types";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  /** 404 from `/me/submissions/{id}` — either missing or not ours. Cannot tell apart. */
  | { kind: "unavailable" }
  | { kind: "ready"; submission: ReviewSubmissionDetailView };

/**
 * Turn an unknown thrown value into user-facing copy.
 *
 * ⚠️ Always layer a fallback UNDER `problem.detail`: on this backend `detail` can
 * be `undefined` (not merely an empty string). `setActionError(undefined)` is a
 * no-op for React's state comparison, so the whole alert block never renders —
 * the user clicks 确认撤回 and simply nothing appears. That was a real bug in
 * this page, found 2026-09-27 with a DOM probe (`alert count: 0` even though
 * `withdraw` had been called).
 */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem.detail?.trim() || fallback;
  }
  return fallback;
}

/*
 * /studio/submissions/:submissionId — 投稿详情 (Phase 2K-2)
 *
 * ⚠️ The withdraw control is NEW FUNCTIONALITY, not a migration.
 * Legacy defined `withdrawReviewSubmission` in its API module but NEVER called it
 * (grep confirms 0 call sites), so its review detail page was read-only. The
 * backend has always supported `POST /me/submissions/{id}/withdraw`, so V2
 * surfaces it — with the constraints the server actually enforces:
 *
 *  - only PENDING is withdrawable (else CONFLICT 「只能撤回待审核的提交」), so the
 *    button is hidden for every other status instead of being rendered disabled
 *    with no explanation;
 *  - withdrawing also pushes the underlying article back to EDITORIAL_DRAFT, which
 *    is user-visible and therefore stated in the confirmation copy;
 *  - successful withdraw returns the row with status WITHDRAWN, which we apply
 *    directly rather than refetching.
 */
export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });

    if (!submissionId) {
      setState({ kind: "unavailable" });
      return;
    }

    submissionsApi
      .getById(submissionId)
      .then((submission) => {
        if (active) setState({ kind: "ready", submission });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = error instanceof ApiError ? error.problem.status : 0;
        // 404 is the documented answer for "not found OR not the owner".
        setState(status === 404 ? { kind: "unavailable" } : { kind: "error" });
      });

    return () => {
      active = false;
    };
  }, [submissionId]);

  async function onWithdraw() {
    if (!submissionId || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setActionError(null);
    try {
      const result = await submissionsApi.withdraw(submissionId);
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              // Apply the server's status; keep the rest of the row as-is.
              submission: { ...current.submission, status: result.status },
            }
          : current,
      );
      setConfirming(false);
    } catch (error) {
      setConfirming(false);
      const status = error instanceof ApiError ? error.problem.status : 0;
      if (status === 404) {
        setState({ kind: "unavailable" });
      } else if (status === 409) {
        // Most likely another tab already withdrew it, or it was decided meanwhile.
        setActionError(describeError(error, "该投稿当前状态不允许撤回。"));
      } else {
        setActionError(describeError(error, "撤回失败，请稍后重试。"));
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  if (state.kind === "loading") return <PageState kind="loading" />;
  if (state.kind === "error") return <PageState kind="error" />;
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="投稿不存在或无权查看" />;
  }

  const { submission } = state;
  const feedback = submissionFeedback(submission);
  const href = submissionArticleHref(submission.status, submission.articleId);
  const withdrawable = canWithdraw(submission.status);

  return (
    <div className="section-gap">
      <nav className="text-xs text-muted-foreground" aria-label="面包屑">
        <Link to="/studio/submissions" className="hover:text-foreground">
          我的投稿
        </Link>
        <span aria-hidden="true"> / </span>
        <span>投稿详情</span>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">投稿详情</h1>
        <p className="text-sm text-muted-foreground">
          {submissionStatusDescription(submission.status)}
        </p>
      </header>

      {actionError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-card p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="section-heading">{submissionTitle(submission)}</h2>
              <span
                className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                data-testid="submission-status"
              >
                {submissionStatusLabel(submission.status)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              提交于 <time dateTime={submission.submittedAt}>{submission.submittedAt}</time>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-foreground">审核意见</h3>
            {feedback ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{feedback}</p>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="submission-no-feedback">
                暂无审核意见。
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {href ? (
              <Link to={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {submission.status?.toUpperCase() === "APPROVED" ? "查看文章" : "去编辑稿件"}
              </Link>
            ) : null}

            {withdrawable ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="ml-auto"
                disabled={pending}
                onClick={() => setConfirming(true)}
              >
                撤回投稿
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {confirming ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-label="确认撤回投稿"
          className="rounded-lg border border-border bg-card p-4"
        >
          <p className="text-sm text-foreground">
            确定撤回这次投稿吗？撤回后稿件会回到可编辑状态，需要修改后可重新提交。
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="destructive" disabled={pending} onClick={() => void onWithdraw()}>
              确认撤回
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
