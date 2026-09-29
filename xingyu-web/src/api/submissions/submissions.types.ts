/*
 * Review submissions ("投稿审核") contract — verified against source AND a live
 * probe (2026-09-27, Phase 2K-2).
 *
 * Endpoints (all session-scoped, `CommunityMeController @RequestMapping("/me")`):
 *   GET  /me/submissions?limit=20           -> ReviewSubmissionDetailView[]
 *   GET  /me/submissions/{submissionId}     -> ReviewSubmissionDetailView (404 if not owner)
 *   POST /me/submissions/{submissionId}/withdraw -> ReviewSubmission
 *
 * ⚠️ THE STATUS SET IS EXACTLY FIVE VALUES, and Legacy's map for them is CORRECT.
 * (Contrast Phase 2J-2, where Legacy's report labels were invented. Here they are
 * not — the full set was confirmed by grepping every `setStatus` in ReviewService:)
 *
 *   line  78  submission.setStatus("PENDING")     on submit
 *   line 163  submission.setStatus("WITHDRAWN")   on withdraw
 *   line 203  submission.setStatus(normalizedDecision)  on admin decision
 *             where normalizeDecision only allows APPROVED / REJECTED / RETURNED
 *
 *   → PENDING | WITHDRAWN | APPROVED | REJECTED | RETURNED
 *
 * ⚠️ THE WITHDRAW RESPONSE TYPE IN LEGACY IS WRONG.
 * Legacy declares `apiRequest<{ id: string; status: string }>`. The server method
 * is `public ReviewSubmission withdraw(...)` — it returns the **entity**, which is
 * a different (larger) shape. V2 types it as `WithdrawalResult` with only the two
 * fields we actually rely on, rather than pretending to know the whole entity.
 *
 * ⚠️ `title`, `coverUrl`, `decision`, `decisionComment` ARE ALL NULLABLE.
 * `toDetailView` does `revision == null ? null : revision.getTitle()` and
 * `decision == null ? null : ...`, so a submission whose formal revision row is
 * gone returns a null title. The UI must never assume a title exists.
 *
 * ⚠️ Withdraw is only legal from PENDING — otherwise the server throws
 * CONFLICT 「只能撤回待审核的提交」. The UI hides the control for non-PENDING
 * submissions rather than rendering a button guaranteed to fail.
 */

/** `ReviewSubmissionDetailView` — exactly 8 fields. */
export type ReviewSubmissionDetailView = {
  id: string;
  articleId: string;
  /** Nullable: depends on the formal revision row still existing. */
  title?: string | null;
  coverUrl?: string | null;
  status: string;
  submittedAt: string;
  /** Nullable: only present once a decision row exists. */
  decision?: string | null;
  decisionComment?: string | null;
};

/** The only two fields we rely on from the withdraw response. */
export type WithdrawalResult = {
  id: string;
  status: string;
};

/** Server default for `GET /me/submissions`. */
export const SUBMISSION_LIST_LIMIT = 20;

/** Legacy requested 50 on its returned-content page; kept for parity where useful. */
export const SUBMISSION_LIST_LIMIT_WIDE = 50;

/** `PENDING` is the only status from which withdrawing is allowed. */
export const WITHDRAWABLE_STATUS = "PENDING";

type StatusMeta = {
  label: string;
  description: string;
  /** Whether the submission is still awaiting a human decision. */
  pending: boolean;
};

/**
 * The five real statuses, with copy mirroring Legacy's (verified-correct) map.
 *
 * Unknown values fall through to a neutral meta that echoes the raw status —
 * Legacy defaulted unknown to the PENDING copy, which would silently claim an
 * unrecognised state is "排队等待中".
 */
const STATUS_META: Record<string, StatusMeta> = {
  PENDING: {
    label: "待审核",
    description: "已进入审核队列，结果会通过通知告知你。",
    pending: true,
  },
  APPROVED: {
    label: "已通过",
    description: "内容已符合社区规范，可以正常展示。",
    pending: false,
  },
  REJECTED: {
    label: "未通过",
    description: "请根据审核意见修改后重新提交。",
    pending: false,
  },
  RETURNED: {
    label: "已退回",
    description: "请根据审核意见修改内容后再次提交。",
    pending: false,
  },
  WITHDRAWN: {
    label: "已撤回",
    description: "你可以继续编辑草稿并重新提交。",
    pending: false,
  },
};

export function submissionStatusLabel(status: string): string {
  return STATUS_META[status?.toUpperCase()]?.label ?? status;
}

export function submissionStatusDescription(status: string): string {
  return (
    STATUS_META[status?.toUpperCase()]?.description ??
    // Do not borrow another status's copy — say only what we know.
    "当前状态暂无法识别。"
  );
}

export function isSubmissionPending(status: string): boolean {
  return STATUS_META[status?.toUpperCase()]?.pending ?? false;
}

/** Only PENDING submissions may be withdrawn. */
export function canWithdraw(status: string): boolean {
  return (status ?? "").toUpperCase() === WITHDRAWABLE_STATUS;
}

/**
 * Where the underlying article should be linked.
 *
 * Only APPROVED content is publicly readable; everything else still lives in the
 * editor. Mirrors Legacy's `resolveArticleHref` — but with an explicit guard,
 * because Legacy's version would build `/articles/undefined` for a missing id.
 */
export function submissionArticleHref(
  status: string,
  articleId: string | null | undefined,
): string | null {
  if (!articleId) {
    return null;
  }
  return (status ?? "").toUpperCase() === "APPROVED"
    ? `/articles/${encodeURIComponent(articleId)}`
    : `/studio/content/${encodeURIComponent(articleId)}`;
}

/**
 * The reviewer's feedback, if any.
 *
 * Returns `null` rather than a filler sentence when there is nothing to show —
 * the page renders an explicit "暂无审核意见" instead of inventing an opinion.
 */
export function submissionFeedback(
  submission: Pick<ReviewSubmissionDetailView, "decisionComment">,
): string | null {
  const comment = submission.decisionComment?.trim();
  return comment ? comment : null;
}

/** Display title, falling back to the article id when the revision is gone. */
export function submissionTitle(
  submission: Pick<ReviewSubmissionDetailView, "title" | "articleId">,
): string {
  return submission.title?.trim() || `未命名投稿（${submission.articleId}）`;
}
