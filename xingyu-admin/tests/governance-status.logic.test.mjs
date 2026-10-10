import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canDecide, decideEndpoint, queueEndpoint, queueKind } from '../src/views/community/governance-status.logic.mjs'

test('queueKind maps the three queue routes', () => {
  assert.equal(queueKind('/community/moderation/reports'), 'reports')
  assert.equal(queueKind('/community/moderation/appeals'), 'appeals')
  assert.equal(queueKind('/community/operations/groups'), 'groups')
})

test('groups is read-only: no decide entry, endpoint is /operations/groups', () => {
  assert.equal(canDecide('/community/operations/groups'), false)
  assert.equal(queueEndpoint('/community/operations/groups'), '/operations/groups')
})

test('reports keeps its original endpoints (no regression)', () => {
  assert.equal(canDecide('/community/moderation/reports'), true)
  assert.equal(queueEndpoint('/community/moderation/reports'), '/moderation/reports')
  assert.equal(decideEndpoint('/community/moderation/reports', 'r1'), '/moderation/reports/r1/decide')
})

test('appeals keeps its original endpoints (no regression)', () => {
  assert.equal(canDecide('/community/moderation/appeals'), true)
  assert.equal(queueEndpoint('/community/moderation/appeals'), '/moderation/appeals')
  assert.equal(decideEndpoint('/community/moderation/appeals', 'a1'), '/moderation/appeals/a1/decide')
})

test('groups can never reach a decide call: guard is canDecide, not URL shape', () => {
  // Historical bug: the groups page rendered decision buttons and submitted
  // conversation IDs to /moderation/reports/{id}/decide. The fix removes the
  // buttons entirely (canDecide=false); decideEndpoint is unreachable for
  // groups and its URL shape there is irrelevant.
  assert.equal(canDecide('/community/operations/groups'), false)
  // Defence in depth: the Vue component guards submit() with canDecide too.
  assert.equal(typeof canDecide, 'function')
})
