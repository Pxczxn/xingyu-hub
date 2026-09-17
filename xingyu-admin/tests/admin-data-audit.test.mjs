import assert from 'node:assert/strict'
import test from 'node:test'
import { register } from 'node:module'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { resolve as pathResolve } from 'node:path'
import { auditAdminDataSources } from '../scripts/admin-data-audit.mjs'

// 允许 Node 直接导入真实的 TS 工具（拦截 @/ 别名与 .vue 值导入）
register('./render-date-loader.mjs', import.meta.url)
const { renderDate, renderDateTime } = await import('../src/utils/table-cells.ts')

test('运营总览不再包含脚手架硬编码和运营占位页', () => {
  const findings = auditAdminDataSources()
  assert.equal(findings.some((item) => item.code === 'DASHBOARD_SCAFFOLD_CONTENT'), false)
})

test('审计结果为每项问题提供可定位的源码路径', () => {
  const findings = auditAdminDataSources()
  for (const finding of findings) {
    assert.match(finding.file, /^src\//)
    assert.ok(finding.message.length > 0)
  }
})

// ---- renderDate / renderDateTime 时区行为（前端收口任务 5） ----
const PURE_DATES = ['2024-03-15', '2024-12-31', '2020-02-29', '1999-01-01', '2000-01-01']

test('renderDate 纯日历日期（YYYY-MM-DD）原样返回，不跨日', () => {
  for (const d of PURE_DATES) {
    const vnode = renderDate(d)
    assert.equal(vnode.children, d, `纯日期 ${d} 应原样返回，不得经 UTC→本地时区转换`)
  }
})

test('renderDate 纯日历日期在正时区与负时区下值不变', () => {
  const loaderUrl = pathToFileURL(pathResolve(import.meta.dirname, 'render-date-loader.mjs')).href
  const moduleUrl = pathToFileURL(pathResolve(import.meta.dirname, '../src/utils/table-cells.ts')).href
  const script = `
    import { register } from 'node:module'
    register(${JSON.stringify(loaderUrl)}, import.meta.url)
    const { renderDate } = await import(${JSON.stringify(moduleUrl)})
    const cases = ${JSON.stringify(PURE_DATES)}
    for (const c of cases) {
      const v = renderDate(c)
      if (v.children !== c) { console.error('FAIL', c, v.children); process.exit(1) }
    }
    console.log('OK')
  `
  for (const tz of ['Asia/Shanghai', 'America/New_York', 'UTC', 'Pacific/Kiritimati']) {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8'
    })
    assert.match(out, /OK/, `纯日期在时区 ${tz} 下应保持不变`)
  }
})

test('renderDateTime 保留时间分量、renderDate 纯日期不含时间分量', () => {
  const dt = renderDateTime('2024-03-15T08:30:00Z')
  assert.match(String(dt.children), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  const d = renderDate('2024-03-15')
  assert.equal(String(d.children), '2024-03-15')
})
