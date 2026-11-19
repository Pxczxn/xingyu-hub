import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventUpdatePatch } from '../src/views/community/events/event-edit-patch.logic.mjs'

const eventBase = {
  title: '旧',
  body: '正文',
  status: 'ACTIVE',
  submissionOpen: true,
  startsAt: '2026-01-01T00:00:00Z',
  endsAt: '2026-02-01T00:00:00Z',
  slug: 'keep'
}

test('event patch sends only the changed field, and a cleared end time is explicit null', () => {
  assert.deepEqual(eventUpdatePatch(eventBase, { ...eventBase, title: '新' }), { title: '新' })
  assert.deepEqual(eventUpdatePatch(eventBase, { ...eventBase, status: 'ARCHIVED' }), { status: 'ARCHIVED' })
  assert.deepEqual(eventUpdatePatch(eventBase, { ...eventBase, endsAt: null }), { endsAt: null })
  assert.deepEqual(eventUpdatePatch(eventBase, { ...eventBase, slug: 'other' }), {})
  assert.deepEqual(eventUpdatePatch(eventBase, { ...eventBase, startsAt: null }), {})
})
