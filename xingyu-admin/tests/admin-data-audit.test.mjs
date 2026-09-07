import assert from 'node:assert/strict'
import test from 'node:test'
import { auditAdminDataSources } from '../scripts/admin-data-audit.mjs'

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
