/*
 * Review submissions ("投稿审核") clients.
 *
 * See submissions.types.ts for the verified contract, the exact five-status set,
 * the Legacy withdraw-response type bug, and the nullable-field warnings.
 */
import { apiRequest } from "@/api/client";
import type { ReviewSubmissionDetailView, WithdrawalResult } from "./submissions.types";
import { SUBMISSION_LIST_LIMIT } from "./submissions.types";

export const submissionsApi = {
  /**
   * `GET /api/v1/me/submissions?limit=20` — every submission this user made,
   * newest first (`submissionMapper.listBySubmittedBy`).
   *
   * Bare array; no cursor and no total.
   */
  listMine: (limit: number = SUBMISSION_LIST_LIMIT): Promise<ReviewSubmissionDetailView[]> =>
    apiRequest<ReviewSubmissionDetailView[]>(`/api/v1/me/submissions?limit=${limit}`),

  /** 404 when the submission exists but belongs to someone else. */
  getById: (submissionId: string): Promise<ReviewSubmissionDetailView> =>
    apiRequest<ReviewSubmissionDetailView>(
      `/api/v1/me/submissions/${encodeURIComponent(submissionId)}`,
    ),

  /**
   * Withdraw a PENDING submission.
   *
   * Side effects worth knowing about (ReviewService.withdraw):
   *  - the submission becomes WITHDRAWN
   *  - if the underlying article is still under review it is pushed back to
   *    EDITORIAL_DRAFT, i.e. the writer can edit it again
   *  - a `revision-withdrawn:<id>` event is published
   *
   * The server rejects anything that is not PENDING with CONFLICT
   * 「只能撤回待审核的提交」 — hence `canWithdraw(status)` in the types module.
   *
   * Declared as `WithdrawalResult` (id + status only): the server actually returns
   * the entity, but we only rely on these two fields, and Legacy's `{id, status}`
   * claim was never verified against the response.
   */
  withdraw: (submissionId: string): Promise<WithdrawalResult> =>
    apiRequest<WithdrawalResult>(
      `/api/v1/me/submissions/${encodeURIComponent(submissionId)}/withdraw`,
      { method: "POST" },
    ),
};
