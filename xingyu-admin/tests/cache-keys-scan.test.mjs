import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('缓存页不再默认 * 全库扫描，并展示截断提示', () => {
  const vue = readFileSync(resolve(root, 'src/views/monitor/cache/index.vue'), 'utf8')
  assert.equal(vue.includes("searchPattern = ref('*')"), false)
  assert.match(vue, /searchPattern = ref\('sys:config:group:'\)/)
  assert.match(vue, /api:access:log:/)
  assert.match(vue, /truncated/)
  assert.match(vue, /SCAN/)
})

test('缓存键 API 使用对象结果而不是裸数组', () => {
  const api = readFileSync(resolve(root, 'src/api/monitor.ts'), 'utf8')
  assert.match(api, /apiRecord<CacheKeyPage>/)
  assert.equal(api.includes('apiList<string>({ url: \'/monitor/cache/keys\''), false)
})
