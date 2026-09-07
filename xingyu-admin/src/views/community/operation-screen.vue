<template>
  <div class="page-container operation-page">
    <section class="operation-hero page-heading">
      <div><span class="eyebrow">社区运营工作台</span><h1>{{ title }}</h1><p>{{ description }}</p></div>
      <div class="hero-actions"><n-button secondary>导出视图</n-button><n-button type="primary">{{ primaryAction }}</n-button></div>
    </section>
    <section class="metric-grid">
      <n-card v-for="metric in metrics" :key="metric.label" class="metric-card" :bordered="false"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small :class="metric.tone">{{ metric.note }}</small></n-card>
    </section>
    <n-card class="operation-card" :bordered="true">
      <div class="card-toolbar"><div><h2>待处理队列</h2><p>按优先级查看当前运营任务和数据状态。</p></div><n-button quaternary size="small">筛选条件</n-button></div>
      <n-data-table :columns="columns" :data="rows" :bordered="false" :single-line="false" />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { h } from 'vue'
import { NTag } from 'naive-ui'

const props = defineProps<{ screen: string }>()
const catalog: Record<string, { title: string; description: string; action: string }> = {
  users: { title: '社区用户', description: '查看社区账号、状态与必要的安全处理入口。', action: '查看用户' },
  userDetail: { title: '用户详情', description: '聚合公开身份、账号状态和受控运营动作。', action: '返回列表' },
  reviews: { title: '内容审核队列', description: '按提交版本处理文章、系列和动态审核。', action: '开始审核' },
  reviewDetail: { title: '审核详情', description: '审核意见只作用于明确版本，并完整留痕。', action: '提交决定' },
  cases: { title: '治理案件工作台', description: '将举报线索、处理决定和执行措施关联为案件。', action: '新建案件' },
  caseDetail: { title: '治理案件详情', description: '案件处理过程、证据与申诉入口保持可追溯。', action: '更新案件' },
  reports: { title: '举报队列', description: '按对象和风险等级查看待处理举报。', action: '分派案件' },
  appeals: { title: '申诉队列', description: '独立复核已执行的治理措施。', action: '开始复核' },
  articles: { title: '文章运营', description: '管理公开内容的展示资格、精选与受控下架。', action: '新建精选' },
  moments: { title: '动态运营', description: '关注公开讨论质量与内容沉淀路径。', action: '查看动态' },
  series: { title: '系列运营', description: '维护系列目录、章节可见性和推荐资格。', action: '查看系列' },
  topics: { title: '话题运营', description: '管理话题介绍、别名、合并和内容投影。', action: '创建话题' },
  tags: { title: '标签运营', description: '维护标签层级、别名与搜索入口。', action: '创建标签' },
  galaxies: { title: '星系运营', description: '维护星系公开身份和受控维护授权。', action: '创建星系' },
  groups: { title: '群聊治理', description: '处理群冻结、解散、申诉和生命周期异常。', action: '查看群聊' },
  events: { title: '活动运营', description: '组织创作挑战、专题活动与投稿结果。', action: '创建活动' },
  featured: { title: '精选运营', description: '精选仅引用仍具备公开资格的内容。', action: '新增精选' },
  announcements: { title: '公告中心', description: '发布全站公告、维护通知范围和有效期。', action: '发布公告' },
  search: { title: '搜索运营', description: '管理热搜、建议、纠错与异常查询。', action: '查看规则' },
  recommendations: { title: '推荐运营', description: '查看候选质量、负反馈与运营干预记录。', action: '查看策略' },
  analytics: { title: '社区数据看板', description: '观察内容、阅读、互动与治理的聚合趋势。', action: '导出数据' },
  reviewPolicy: { title: '审核规则', description: '维护审核规则版本和适用范围。', action: '新建规则' },
  governancePolicy: { title: '治理规则', description: '维护治理措施、原因类型和申诉窗口。', action: '新建规则' },
  operationRoles: { title: '运营角色', description: '查看运营岗位可使用的受控业务动作。', action: '查看角色' },
  operationAdmins: { title: '运营管理员', description: '管理运营工作台访问人员与账号状态。', action: '查看管理员' },
  operationAudit: { title: '运营审计记录', description: '追溯审核、治理和运营操作的责任链路。', action: '查看记录' },
}
const info = computed(() => catalog[props.screen] || catalog.articles)
const title = computed(() => info.value.title)
const description = computed(() => info.value.description)
const primaryAction = computed(() => info.value.action)
const metrics = [{ label: "待处理", value: "24", note: "较昨日 +6", tone: "up" }, { label: "今日新增", value: "138", note: "内容与互动", tone: "neutral" }, { label: "处理完成率", value: "92%", note: "过去 7 天", tone: "up" }, { label: "风险提醒", value: "3", note: "需要关注", tone: "warn" }]
const rows = [{ id: "OP-2401", subject: "社区内容质量巡检", owner: "运营值班组", updated: "10 分钟前", status: "进行中" }, { id: "OP-2398", subject: "精选内容复核", owner: "内容运营", updated: "32 分钟前", status: "待处理" }, { id: "OP-2392", subject: "用户反馈汇总", owner: "社区治理", updated: "1 小时前", status: "已完成" }]
const columns = [{ title: "任务", key: "subject" }, { title: "负责人", key: "owner" }, { title: "更新时间", key: "updated" }, { title: "状态", key: "status", render: (row: any) => h(NTag, { type: row.status === "已完成" ? "success" : row.status === "进行中" ? "info" : "warning", bordered: false }, { default: () => row.status }) }]
</script>

<style scoped lang="scss">
.operation-page {
  max-width: 1480px;
  margin: 0 auto;
}

.eyebrow { display:block; margin-bottom:8px; color:#7b879d; font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }

.hero-actions { display:flex; gap:10px; }

.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:20px 0; }
.metric-card { min-height:118px; }
.metric-card span,.metric-card small { display:block; color:#78859b; font-size:13px; }
.metric-card strong { display:block; margin:12px 0 6px; color:#1d315b; font-size:30px; }
.metric-card small.up { color:#2e9a73; }.metric-card small.warn { color:#d1773d; }
.card-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }.card-toolbar h2 { margin:0; color:#20355f; font-size:18px; }.card-toolbar p { margin:5px 0 0; color:#8691a4; font-size:13px; }

.operation-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
}

@media (max-width: 900px) { .metric-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }

@media (max-width: 640px) {
  .eyebrow { display:block; margin-bottom:8px; color:#7b879d; font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }

.hero-actions { display:flex; gap:10px; }

.metric-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:20px 0; }
.metric-card { min-height:118px; }
.metric-card span,.metric-card small { display:block; color:#78859b; font-size:13px; }
.metric-card strong { display:block; margin:12px 0 6px; color:#1d315b; font-size:30px; }
.metric-card small.up { color:#2e9a73; }.metric-card small.warn { color:#d1773d; }
.card-toolbar { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }.card-toolbar h2 { margin:0; color:#20355f; font-size:18px; }.card-toolbar p { margin:5px 0 0; color:#8691a4; font-size:13px; }

.operation-hero {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
