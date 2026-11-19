/**
 * 活动投稿审核入口。真实待审状态只有 SUBMITTED。
 * 列表按钮、打开确认和提交前都用同一组判断。
 */

export const submissionReviewSuccessMessage = {
  ACCEPTED: '已通过',
  REJECTED: '已拒绝'
}

export const submissionReviewFailureMessage = '审核失败'

export function canReviewEventSubmission(status) {
  return status === 'SUBMITTED'
}

export function eventSubmissionStatusLabel(status) {
  if (status === 'SUBMITTED') return '待审核'
  if (status === 'ACCEPTED') return '已通过'
  if (status === 'REJECTED') return '已拒绝'
  return '未知状态'
}

export function eventSubmissionReviewActions(status) {
  if (status === 'SUBMITTED') return ['通过', '拒绝']
  return []
}

/** 打开确认前再看当前状态。终态和未知状态都不打开。 */
export function beginSubmissionReview(status) {
  return canReviewEventSubmission(status)
}

/**
 * 提交前再看当前列表里的状态。页面加载后若已离开 SUBMITTED，不再发请求。
 */
export function commitSubmissionReview(statusAtSubmit) {
  return canReviewEventSubmission(statusAtSubmit)
}
