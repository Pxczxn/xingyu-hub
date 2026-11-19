import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  beginSubmissionReview,
  commitSubmissionReview,
  eventSubmissionReviewActions,
  eventSubmissionStatusLabel,
  submissionReviewFailureMessage,
  submissionReviewSuccessMessage
} from '../src/views/community/events/event-submission-review.logic.mjs'

test('SUBMITTED shows accept and reject', () => {
  assert.deepEqual(eventSubmissionReviewActions('SUBMITTED'), ['通过', '拒绝'])
  assert.equal(beginSubmissionReview('SUBMITTED'), true)
  assert.equal(commitSubmissionReview('SUBMITTED'), true)
})

test('ACCEPTED shows the terminal label and no review buttons', () => {
  assert.equal(eventSubmissionStatusLabel('ACCEPTED'), '已通过')
  assert.deepEqual(eventSubmissionReviewActions('ACCEPTED'), [])
  assert.equal(beginSubmissionReview('ACCEPTED'), false)
})

test('REJECTED shows the terminal label and no review buttons', () => {
  assert.equal(eventSubmissionStatusLabel('REJECTED'), '已拒绝')
  assert.deepEqual(eventSubmissionReviewActions('REJECTED'), [])
  assert.equal(beginSubmissionReview('REJECTED'), false)
})

test('unknown and blank statuses show 未知状态 and cannot open review', () => {
  for (const status of ['HOLD', 'APPROVED', 'DISMISSED', '', '  ', null, undefined]) {
    assert.equal(eventSubmissionStatusLabel(status), '未知状态')
    assert.deepEqual(eventSubmissionReviewActions(status), [])
    assert.equal(beginSubmissionReview(status), false)
    assert.equal(commitSubmissionReview(status), false)
  }
})

test('a row that leaves SUBMITTED after the page loaded is not submitted', () => {
  let status = 'SUBMITTED'
  assert.equal(beginSubmissionReview(status), true)
  status = 'ACCEPTED'
  assert.equal(commitSubmissionReview(status), false)
  status = 'REJECTED'
  assert.equal(commitSubmissionReview(status), false)
})

test('existing review feedback stays on the same phrases', () => {
  assert.equal(submissionReviewSuccessMessage.ACCEPTED, '已通过')
  assert.equal(submissionReviewSuccessMessage.REJECTED, '已拒绝')
  assert.equal(submissionReviewFailureMessage, '审核失败')
})
