<template>
  <main class="operations-page operations-dashboard">
    <header class="operations-header">
      <div>
        <h1>运营总览</h1>
        <p class="header-copy">把需要判断和处理的事项留在前面，其余数据回到各自的工作台。</p>
      </div>
      <n-button :loading="loading" secondary @click="load">刷新数据</n-button>
    </header>

    <n-alert v-if="error" type="error" :show-icon="true" title="运营数据未能加载" class="load-error">
      <template #action><n-button size="small" @click="load">重新加载</n-button></template>
      请确认管理端与后端服务连接正常。
    </n-alert>

    <section class="overview-layout" aria-label="运营重点">
      <div class="priority-panel">
        <div class="priority-copy">
          <p>当前优先事项</p>
          <strong v-if="!loading">{{ pendingTotal }}</strong>
          <n-skeleton v-else :width="96" :height="48" />
          <span>项审核或治理待办</span>
          <n-button type="primary" @click="router.push(priorityPath)">{{ pendingTotal > 0 ? '开始处理' : '查看审核工作台' }}</n-button>
        </div>
        <img src="/images/dashboard-analytics.png" width="960" height="420" fetchpriority="high" alt="由仪表盘与星图节点构成的运营数据看板" />
      </div>
      <div class="status-note">
        <span class="note-dot" aria-hidden="true"></span>
        <div>
          <h2>社区脉冲</h2>
          <p>总览中的每个数字都来自当前社区数据；点击卡片可直接进入对应工作台。</p>
        </div>
      </div>
    </section>

    <section class="metric-grid" aria-label="运营数据">
      <button v-for="card in cards" :key="card.key" class="metric-card" type="button" @click="router.push(card.path)">
        <span class="metric-label">{{ card.title }}</span>
        <n-skeleton v-if="loading" text :width="72" />
        <strong v-else>{{ overview?.[card.key] ?? 0 }}</strong>
        <span class="metric-hint">{{ card.hint }} <span aria-hidden="true">→</span></span>
      </button>
    </section>

    <section class="workbench-row">
      <n-card class="workbench-card">
        <template #header>现在可以做什么</template>
        <div class="action-list">
          <button v-for="action in actions" :key="action.label" type="button" @click="router.push(action.path)">
            <span>{{ action.label }}</span>
            <small>{{ action.description }}</small>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </n-card>
      <n-card class="workbench-card calm-card">
        <template #header>运营原则</template>
        <p>审核与治理负责守住社区边界；内容、活动和星系的价值，仍应沉淀回用户可见的社区体验。</p>
        <n-button text type="primary" @click="router.push('/community/operations/guides')">查看社区指南</n-button>
      </n-card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { operationsApi, type OperationsOverview } from '@/api/operations'

const router = useRouter()
const loading = ref(true)
const error = ref(false)
const overview = ref<OperationsOverview | null>(null)

const cards = [
  { key: 'pendingReviewCount', title: '待审核内容', hint: '进入内容审核', path: '/community/review' },
  { key: 'openCaseCount', title: '治理案件', hint: '进入治理案件', path: '/community/moderation' },
  { key: 'publishedArticleCount', title: '已发布文章', hint: '管理文章内容', path: '/community/operations/articles' },
  { key: 'activeEventCount', title: '进行中活动', hint: '管理社区活动', path: '/community/operations/events' }
] as const

const actions = [
  { label: '审核新内容', description: '处理等待发布的投稿', path: '/community/review' },
  { label: '查看治理案件', description: '跟进举报与处置流程', path: '/community/moderation' },
  { label: '运营社区活动', description: '维护活动与参与入口', path: '/community/operations/events' }
]

const pendingTotal = computed(() => (overview.value?.pendingReviewCount ?? 0) + (overview.value?.openCaseCount ?? 0))
const priorityPath = computed(() => (overview.value?.pendingReviewCount ?? 0) > 0 ? '/community/review' : '/community/moderation')

async function load() {
  loading.value = true
  error.value = false
  try {
    overview.value = await operationsApi.getOverview()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.operations-dashboard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 4px;

  > header,
  > .n-alert,
  > section {
    flex-shrink: 0;
  }
}

.operations-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin: 0;
}

h1 {
  margin: 0 0 4px;
  color: #172641;
  font-size: 22px;
  letter-spacing: -.02em;
  line-height: 1.2;
}

.header-copy {
  margin: 0;
  color: #728098;
  font-size: 13px;
  line-height: 1.4;
}

.load-error {
  margin-bottom: 12px;
}

.overview-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(220px, .9fr);
  gap: 10px;
  margin-bottom: 0;
}

.priority-panel {
  height: clamp(190px, 25vh, 230px);
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(230px, 30%) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
  border-radius: var(--radius-card);
  background: linear-gradient(135deg, #172a48 0%, #1e3458 55%, #243d66 100%);
  box-shadow: var(--admin-shadow-md);
  color: #fff;
}

.priority-copy {
  min-height: 0;
  padding: 20px 24px;
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 4px;
  z-index: 1;
}

.priority-copy p,
.priority-copy span {
  margin: 0;
  color: #b9c5dc;
  font-size: 13px;
}

.priority-copy strong {
  min-height: 44px;
  font-size: 44px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.priority-copy :deep(.n-button) {
  margin-top: 8px;
}

.priority-panel img {
  width: 100%;
  height: 100%;
  min-width: 0;
  object-fit: cover;
  object-position: center 48%;
  opacity: .9;
}

.status-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 18px 20px;
  border: 1px solid var(--xingyu-border);
  border-radius: var(--radius-card);
  background: var(--admin-surface-raised);
  box-shadow: var(--admin-shadow-sm);
}

.note-dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  background: #c89d4b;
  box-shadow: 0 0 0 5px #f8efdd;
}

.status-note h2 {
  margin: 0 0 6px;
  color: #263650;
  font-size: 16px;
  line-height: 1.3;
}

.status-note p,
.calm-card p {
  margin: 0;
  color: #748198;
  font-size: 13px;
  line-height: 1.55;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 0;
}

.metric-card {
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--xingyu-border);
  border-left: 3px solid var(--xingyu-violet);
  border-radius: var(--radius-card);
  background: var(--admin-surface-raised);
  box-shadow: var(--admin-shadow-sm);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--admin-transition);
}

.metric-card:hover {
  border-color: #c5cfe0;
  border-left-color: var(--xingyu-violet);
  box-shadow: var(--admin-shadow-hover);
}

.metric-label {
  color: #6e7d96;
  font-size: 13px;
}

.metric-card strong {
  color: #1f3152;
  font-size: 22px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.metric-hint {
  color: #98783d;
  font-size: 12px;
}

.workbench-row {
  display: grid;
  grid-template-columns: 1.45fr 1fr;
  gap: 12px;
  align-items: stretch;
}

.workbench-card {
  border-radius: 12px;
  height: auto;

  :deep(.n-card-header) {
    padding-top: 10px;
    padding-bottom: 6px;
    font-size: 14px;
  }

  :deep(.n-card__content) {
    overflow: visible;
    padding-top: 8px;
    padding-bottom: 12px;
  }
}

.action-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.action-list button {
  position: relative;
  display: grid;
  gap: 3px;
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid var(--xingyu-border);
  border-radius: var(--radius-control);
  background: var(--admin-surface-raised);
  text-align: left;
  cursor: pointer;
  transition: var(--admin-transition);
}

.action-list button:hover {
  border-color: #c5cfe0;
  background: var(--admin-surface-muted);
  box-shadow: var(--admin-shadow-sm);
}

.action-list button:focus-visible {
  outline: 2px solid rgb(93 90 168 / 0.45);
  outline-offset: 2px;
}

.action-list span {
  color: #253652;
  font-weight: 600;
  font-size: 14px;
}

.action-list small {
  padding-right: 14px;
  color: #7b879b;
  font-size: 12px;
  line-height: 1.4;
}

.action-list b {
  position: absolute;
  right: 12px;
  bottom: 12px;
  color: #9b7c42;
}

.calm-card :deep(.n-card__content) {
  display: grid;
  gap: 10px;
  align-content: start;
}

.calm-card :deep(.n-button) {
  justify-self: start;
}

@media (max-width: 1200px) {
  .overview-layout,
  .workbench-row {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 960px) {
  .action-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .operations-header {
    align-items: stretch;
    flex-direction: column;
  }

  .priority-panel img {
    display: none;
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .priority-copy {
    padding: 18px;
  }
}

@media (max-height: 860px) {
  .priority-panel {
    min-height: 148px;
  }

  .priority-copy strong {
    font-size: 36px;
    min-height: 36px;
  }

  .action-list button {
    min-height: 76px;
    padding: 10px 12px;
  }
}
</style>
