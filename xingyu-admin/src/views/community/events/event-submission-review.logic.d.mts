export declare const submissionReviewSuccessMessage: {
  ACCEPTED: '已通过'
  REJECTED: '已拒绝'
}
export declare const submissionReviewFailureMessage: '审核失败'
export declare function canReviewEventSubmission(status: string | null | undefined): boolean
export declare function eventSubmissionStatusLabel(status: string | null | undefined): string
export declare function eventSubmissionReviewActions(status: string | null | undefined): string[]
export declare function beginSubmissionReview(status: string | null | undefined): boolean
export declare function commitSubmissionReview(status: string | null | undefined): boolean
