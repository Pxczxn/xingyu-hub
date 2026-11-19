import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guideUpdatePatch } from '../src/views/community/guides/guide-edit-patch.logic.mjs'

const guideBase = { title: '旧', body: '正文', status: 'PUBLISHED', sortOrder: 2, slug: 'keep' }

test('guide patch sends only the changed field and never the slug', () => {
  assert.deepEqual(guideUpdatePatch(guideBase, { ...guideBase, title: '新' }), { title: '新' })
  assert.deepEqual(guideUpdatePatch(guideBase, { ...guideBase, status: 'DRAFT' }), { status: 'DRAFT' })
  assert.deepEqual(guideUpdatePatch(guideBase, { ...guideBase, slug: 'other' }), {})
})
