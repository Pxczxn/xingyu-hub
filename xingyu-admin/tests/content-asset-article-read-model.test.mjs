import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  articleAnonymousLabel,
  articlePublicationLabel,
  articleVisibilityLabel
} from '../src/views/community/content-asset-article-read-model.mjs'

test('publication label keeps true, false, and missing apart', () => {
  assert.equal(articlePublicationLabel(true), '有正式发布版本')
  assert.equal(articlePublicationLabel(false), '没有发布版本')
  assert.equal(articlePublicationLabel(null), '不可判断')
  assert.equal(articlePublicationLabel(undefined), '不可判断')
})

test('visibility uses a real value, an explicit empty publication, or unknown', () => {
  assert.equal(articleVisibilityLabel(true, 'PUBLIC'), '公开列出')
  assert.equal(articleVisibilityLabel(true, 'UNLISTED'), '链接可读，不进搜索')
  assert.equal(articleVisibilityLabel(true, 'PRIVATE'), '仅作者')
  assert.equal(articleVisibilityLabel(false, null), '没有发布版本')
  assert.equal(articleVisibilityLabel(true, null), '不可判断')
  assert.equal(articleVisibilityLabel(true, 'CUSTOM'), '不可判断')
  assert.equal(articleVisibilityLabel(undefined, undefined), '不可判断')
  assert.equal(articleVisibilityLabel(false, undefined), '不可判断')
})

test('anonymous readability does not treat a missing field as unreadable', () => {
  assert.equal(articleAnonymousLabel(true), '匿名可读')
  assert.equal(articleAnonymousLabel(false), '匿名不可读')
  assert.equal(articleAnonymousLabel(null), '不可判断')
  assert.equal(articleAnonymousLabel(undefined), '不可判断')
})
