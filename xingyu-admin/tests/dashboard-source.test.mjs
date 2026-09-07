import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const dashboardPath = path.resolve('src/views/dashboard/index.vue')

test('运营总览只展示社区运营数据，不保留脚手架展示内容', () => {
  const source = fs.readFileSync(dashboardPath, 'utf8')

  assert.match(source, /operationsApi\.getOverview/)
  assert.doesNotMatch(source, /技术栈|更新日志|开源免费|云端部署|const banners/)
})
