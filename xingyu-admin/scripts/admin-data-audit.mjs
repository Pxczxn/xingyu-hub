import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')

const auditRules = [
  {
    code: 'DASHBOARD_SCAFFOLD_CONTENT',
    file: 'src/views/dashboard/index.vue',
    matches: (source) => /const\s+(banners|changelog)\s*=/.test(source)
      || /技术栈|更新日志/.test(source),
    message: '运营总览仍包含脚手架轮播或更新日志，必须替换为真实运营数据。'
  },
  {
    code: 'OPERATION_PLACEHOLDER_PAGE',
    file: 'src/views/community/operation-screen.vue',
    matches: (source) => /尚未接入后端 API|disabled>\{\{ primaryAction \}\}/.test(source),
    message: '运营路由仍渲染占位页面，必须替换为真实数据页面或明确的接口不可用状态。'
  }
]

export function auditAdminDataSources() {
  return auditRules.flatMap((rule) => {
    const source = readFileSync(resolve(projectRoot, rule.file), 'utf8')
    return rule.matches(source)
      ? [{ code: rule.code, file: rule.file, message: rule.message }]
      : []
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditAdminDataSources(), null, 2))
}
