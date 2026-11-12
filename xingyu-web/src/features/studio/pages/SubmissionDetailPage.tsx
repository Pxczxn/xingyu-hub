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
import { ArchetypeFrame } from "@/components/layout";
import { PageState } from "@/components/shared/PageState";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
 * this page, found 2026-09-27 with a DOM probe.
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
 * 骨架迁移（批次 D）：SK3 控制台 · H 壳 / D 松 / R 错
 * --------------------------------------------------
 *   SK3  `ArchetypeFrame skeleton="SK3"` + 传 `rail` ⇒ `WITH_RAIL.SK3` 的
 *        `[minmax(0,1fr) 280px]`，右轨由 `SectionRail` 粘住。那就是 R=错：
 *        主列 + 侧轨，打破单一竖列。
 *   H=壳：`WorkbenchShell` 无 heading，页内必须恰好 1 个 `h1`；首块是状态陈述与
 *        卡面、没有视觉标题位 → `sr-only`（A §7.2）。注意投稿标题是 `h2`，
 *        不是第二个 h1（一个路由只有一个 h1）。
 *   D=松：主列是一张独立卡面（一张卡 = 一个可独立理解的内容），卡内 padding 与
 *        卡间距走 `--density-card-pad` / `--density-list-gap`，由 frame 的
 *        `density="loose"` 重新指向 24 / 16。
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
  /* Bumping the key replays the load effect — the retry mechanism for the
     error branch below. The effect keeps its per-run `active` guard. */
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [submissionId, reloadKey]);

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
  if (state.kind === "error") {
    return (
      <div className="section-gap">
        <PageState kind="error" />
        <div className="text-center">
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }
  if (state.kind === "unavailable") {
    return <PageState kind="empty" title="投稿不存在或无权查看" />;
  }

  const { submission } = state;
  const feedback = submissionFeedback(submission);
  const href = submissionArticleHref(submission.status, submission.articleId);
  const withdrawable = canWithdraw(submission.status);

  return (
    <ArchetypeFrame
      skeleton="SK3"
      header="shell"
      density="loose"
      railLabel="提交信息"
      rail={
        <div className="density-loose flex flex-col gap-4 p-[var(--density-card-pad)]">
          <div className="flex flex-col gap-1">
            <p className="text-meta text-muted-foreground">当前状态</p>
            <span
              data-testid="submission-status"
              className="w-fit rounded-pill border border-border px-2 py-0.5 text-caption text-foreground"
            >
              {submissionStatusLabel(submission.status)}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-meta text-muted-foreground">提交时间</p>
            <time
              dateTime={submission.submittedAt}
              className="break-all text-meta tabular-nums text-foreground"
            >
              {submission.submittedAt}
            </time>
          </div>

          {/* 一句静态说明，不是数据：审核通过之后文章才会对读者可见，而在待审期间
              正文仍可编辑但不会外显。放在轨道上是因为它是"这一页怎么读"的背景，
              不属于眼前这一条投稿的具体内容。 */}
          <p className="text-caption leading-5 text-muted-foreground">
            审核通过后文章才会公开。待审核期间正文仍可编辑，但不会对外可见。
          </p>

          <Link
            to="/studio/submissions"
            className="focus-ring w-fit rounded-sm text-meta text-accent-strong hover:underline"
          >
            返回我的投稿
          </Link>
        </div>
      }
    >
      {/* B 类壳：恰好 1 个 h1，视觉隐藏；首块仍是内容。 */}
      <h1 className="sr-only">投稿详情</h1>

      <p className="text-meta leading-6 text-muted-foreground">
        {submissionStatusDescription(submission.status)}
      </p>

      {actionError ? (
        <p
          role="alert"
          className="rounded-control border border-destructive/40 bg-card p-3 text-meta text-destructive"
        >
          {actionError}
        </p>
      ) : null}

      <section
        aria-labelledby="submission-title"
        className="flex flex-col gap-4 rounded-card border border-border/70 bg-card p-[var(--density-card-pad)]"
      >
        <div className="flex flex-col gap-2">
          <h2 id="submission-title" className="section-heading break-words">
            {submissionTitle(submission)}
          </h2>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-meta font-medium text-foreground">审核意见</h3>
          {feedback ? (
            <p className="whitespace-pre-wrap text-meta leading-6 text-muted-foreground">
              {feedback}
            </p>
          ) : (
            <p className="text-meta text-muted-foreground" data-testid="submission-no-feedback">
              暂无审核意见。
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
          {href ? (
            <Link to={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {submission.status?.toUpperCase() === "APPROVED" ? "查看文章" : "去编辑稿件"}
            </Link>
          ) : null}

          {withdrawable ? (
            /* 浮层统一：撤回确认收敛到 `components/ui/dialog`（role="alertdialog"），
               取消在左、破坏性动作在右；关闭后焦点回到这个 DialogTrigger。 */
            <Dialog open={confirming} onOpenChange={setConfirming}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  disabled={pending}
                >
                  撤回投稿
                </Button>
              </DialogTrigger>
              <DialogContent role="alertdialog" className="max-w-sm rounded-xl bg-card">
                <DialogTitle className="text-base font-semibold text-primary">
                  确认撤回投稿
                </DialogTitle>
                <DialogDescription className="text-sm leading-6 text-muted-foreground">
                  确定撤回这次投稿吗？撤回后稿件会回到可编辑状态，需要修改后可重新提交。
                </DialogDescription>
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirming(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => void onWithdraw()}
                  >
                    确认撤回
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </section>
    </ArchetypeFrame>
  );
}
