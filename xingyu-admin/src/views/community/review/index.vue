<template>
  <main class="content-review-page">
    <section class="review-main">
      <header class="review-heading">
        <div><h1>内容审核</h1><p>审核社区内容，维护社区氛围</p></div>
        <n-button secondary size="small" :loading="loading" @click="load">刷新队列</n-button>
      </header>

      <div class="review-tabs" aria-label="审核范围">
        <button class="is-active" type="button">待审核 <b>{{ items.length }}</b></button>
        <button type="button" disabled>已处理</button>
        <button type="button" disabled>全部内容</button>
      </div>

      <section class="review-filter" role="search">
        <n-input v-model:value="keyword" clearable placeholder="搜索标题 / 内容 / 作者" />
        <n-select v-model:value="authorFilter" :options="authorOptions" clearable placeholder="作者：全部" />
        <n-button tertiary @click="keyword = ''; authorFilter = null">重置</n-button>
      </section>

      <div class="queue-caption"><span>共 {{ filteredItems.length }} 条待审核内容</span><span>最新提交</span></div>
      <n-alert v-if="error" type="error" :show-icon="true">{{ error }} <n-button text type="primary" @click="load">重试</n-button></n-alert>

      <section v-if="filteredItems.length || loading" class="review-queue" :aria-busy="loading">
        <article v-for="(item, index) in filteredItems" :key="item.submissionId" class="review-item" :class="{ 'is-selected': selected?.submissionId === item.submissionId }" @click="selected = item">
          <div class="review-thumb" :class="'review-thumb--' + index % 4" aria-hidden="true"><span>{{ item.title?.slice(0, 1) || '文' }}</span></div>
          <div class="review-copy">
            <span class="content-kind">文章</span>
            <h2>{{ item.title || '未命名内容' }}</h2>
            <p>{{ item.summary || item.body || '该内容暂未提供摘要。' }}</p>
            <footer>作者：{{ authorLabel(item) }}　·　提交于 {{ item.submittedAt || '暂未记录' }}</footer>
          </div>
          <div class="review-actions" @click.stop>
            <n-button size="small" type="success" ghost @click="openDecision(item.submissionId, 'APPROVED')">通过</n-button>
            <n-button size="small" type="error" ghost @click="openDecision(item.submissionId, 'REJECTED')">拒绝</n-button>
            <n-button size="small" ghost @click="openDecision(item.submissionId, 'RETURNED')">退回修改</n-button>
          </div>
        </article>
      </section>

      <EmptyState v-else-if="!error" title="审核队列已清空" description="当前没有需要处理的投稿，新的提交会在这里出现。" />
    </section>

    <aside class="review-inspector" aria-label="内容详情">
      <header><h2>内容详情</h2><button type="button" aria-label="关闭详情" @click="selected = null">×</button></header>
      <template v-if="selected">
        <section class="inspector-section"><h3>基本信息</h3><dl><div><dt>内容类型</dt><dd><n-tag size="small" type="info">文章</n-tag></dd></div><div><dt>内容 ID</dt><dd>{{ selected.articleId }}</dd></div><div><dt>提交时间</dt><dd>{{ selected.submittedAt || '暂未记录' }}</dd></div></dl></section>
        <section class="inspector-section author-card"><h3>作者信息</h3><div class="author-head"><div class="author-avatar">{{ authorLabel(selected).slice(0, 1) }}</div><div><strong>{{ authorLabel(selected) }}</strong><small>{{ selected.authorUsername || selected.submittedBy || '未提供用户名' }}</small></div></div></section>
        <section class="inspector-section"><h3>内容预览</h3><h4>{{ selected.title || '未命名内容' }}</h4><p class="article-preview">{{ selected.body || selected.summary || '该内容暂未提供正文。' }}</p></section>
        <section class="inspector-note"><h3>审核备注</h3><n-input v-model:value="comment" type="textarea" :rows="4" placeholder="填写审核备注（可选）" /></section>
        <footer class="inspector-actions"><n-button @click="openDecision(selected.submissionId, 'RETURNED')">退回修改</n-button><n-button type="error" ghost @click="openDecision(selected.submissionId, 'REJECTED')">拒绝</n-button><n-button type="primary" :loading="deciding" @click="openDecision(selected.submissionId, 'APPROVED')">审核通过</n-button></footer>
      </template>
      <section v-else class="inspector-empty"><i aria-hidden="true"></i><h3>选择一条内容</h3><p>内容详情与审核备注会显示在这里。</p></section>
    </aside>

    <n-modal v-model:show="modal" preset="dialog" title="提交审核决定" positive-text="提交" negative-text="取消" :positive-button-props="{ loading: deciding }" @positive-click="decide">
      <p class="decision-hint">即将提交：{{ selectedDecision?.decision === 'APPROVED' ? '通过' : selectedDecision?.decision === 'REJECTED' ? '拒绝' : '退回修改' }}</p>
      <n-input v-model:value="comment" type="textarea" placeholder="填写处理意见（可选）" :rows="4" />
    </n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAlert, NInput, NModal, useMessage } from 'naive-ui'
import { reviewApi, type ReviewQueueItem } from '@/api/review'
import EmptyState from '@/components/EmptyState.vue'

const message = useMessage()
const route = useRoute()
const loading = ref(false)
const deciding = ref(false)
const items = ref<ReviewQueueItem[]>([])
const selected = ref<ReviewQueueItem | null>(null)
const selectedDecision = ref<{ id: string; decision: string } | null>(null)
const modal = ref(false)
const comment = ref('')
const keyword = ref('')
const authorFilter = ref<string | null>(null)
const error = ref('')

const authorOptions = computed(() => Array.from(new Set(items.value.map(authorLabel))).filter(Boolean).map(label => ({ label, value: label })))
const filteredItems = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return items.value.filter(item => {
    const matchesQuery = !query || [item.title, item.summary, item.body, authorLabel(item)].some(value => value?.toLowerCase().includes(query))
    return matchesQuery && (!authorFilter.value || authorLabel(item) === authorFilter.value)
  })
})
function authorLabel(item: ReviewQueueItem) { return item.authorDisplayName || item.authorUsername || item.authorLabel || item.submittedBy || '未知作者' }
async function load() {
  loading.value = true
  try {
    error.value = ''
    items.value = await reviewApi.queue()
    selected.value = items.value[0] || null
  } catch (caught: any) {
    error.value = caught?.message || '加载审核队列失败'
    items.value = []
    selected.value = null
  } finally { loading.value = false }
}
function openDecision(id: string, decision: string) { selectedDecision.value = { id, decision }; comment.value = ''; modal.value = true }
async function decide() {
  if (!selectedDecision.value || deciding.value) return
  deciding.value = true
  try {
    await reviewApi.decide(selectedDecision.value.id, selectedDecision.value.decision, comment.value || undefined)
    modal.value = false
    message.success('审核决定已提交')
    await load()
  } catch { message.error('审核操作失败，请稍后重试') } finally { deciding.value = false }
}
onMounted(async () => {
  await load()
  const taskId = route.params.taskId as string | undefined
  if (taskId) selected.value = items.value.find(item => item.submissionId === taskId) || null
})
</script>

<style scoped lang="scss">
.content-review-page { display: grid; grid-template-columns: minmax(0, 1fr) 360px; height: 100%; min-height: 0; overflow: hidden; background: #fbfaf7; color: #202d45; }
.review-main { display: flex; min-width: 0; min-height: 0; flex-direction: column; padding: 20px 24px 18px; border-right: 1px solid #ece8e2; }.review-heading { display: flex; align-items: end; justify-content: space-between; }.review-heading h1 { margin: 0; font-size: 26px; line-height: 1.15; }.review-heading p { display: inline; margin: 0 0 0 13px; color: #758095; font-size: 14px; }.review-tabs { display: flex; gap: 36px; margin-top: 28px; border-bottom: 1px solid #ede8e2; }.review-tabs button { padding: 0 10px 13px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #59677c; cursor: pointer; font-size: 14px; }.review-tabs button:disabled { cursor: default; }.review-tabs .is-active { border-color: #ee812e; color: #e56f1d; font-weight: 650; }.review-tabs b { margin-left: 6px; border-radius: 12px; background: #fff0e4; padding: 2px 7px; font-size: 11px; }
.review-filter { display: grid; grid-template-columns: minmax(220px, 1fr) 170px auto; gap: 12px; padding: 15px 4px 13px; border-bottom: 1px solid #ede8e2; }.queue-caption { display: flex; justify-content: space-between; padding: 12px 2px; color: #81899a; font-size: 13px; }.queue-caption span:last-child { border: 1px solid #eee9e1; border-radius: 6px; padding: 5px 9px; font-size: 12px; }
.review-queue { display: grid; gap: 12px; overflow: auto; padding-right: 3px; }.review-item { display: grid; grid-template-columns: 116px minmax(0, 1fr) auto; align-items: center; gap: 16px; min-height: 146px; padding: 14px; border: 1px solid #ece7e0; border-radius: 10px; background: rgb(255 255 255 / .88); cursor: pointer; transition: border-color .18s, box-shadow .18s; }.review-item:hover, .review-item.is-selected { border-color: #efb37e; box-shadow: 0 8px 20px rgb(66 52 35 / .06); }.review-thumb { position: relative; display: grid; width: 116px; height: 116px; place-items: center; overflow: hidden; border-radius: 7px; background: radial-gradient(circle at 68% 22%, #d8e5ff 0 2%, transparent 3%), linear-gradient(145deg, #0b1d39, #284a70); color: rgb(255 255 255 / .74); font-size: 32px; }.review-thumb::after { position: absolute; inset: 35% -20% -20%; background: linear-gradient(160deg, transparent 0 42%, rgb(223 179 119 / .55) 43% 46%, transparent 47%); content: ''; }.review-thumb--1 { background: linear-gradient(145deg, #f5eee3, #fcfaf5); color: #8b8377; }.review-thumb--2 { background: radial-gradient(circle at 56% 29%, #9a8be4 0 5%, transparent 6%), linear-gradient(145deg, #111d49, #332c63); }.review-thumb--3 { background: linear-gradient(145deg, #ecd6bd, #886456); }.review-copy { min-width: 0; }.content-kind { display: inline-flex; border-radius: 5px; background: #eef4ff; padding: 3px 8px; color: #4d7ebb; font-size: 12px; }.review-copy h2 { overflow: hidden; margin: 9px 0 6px; color: #202c40; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }.review-copy p { display: -webkit-box; overflow: hidden; margin: 0; color: #718094; font-size: 13px; line-height: 1.65; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.review-copy footer { margin-top: 9px; color: #7e8999; font-size: 12px; }.review-actions { display: flex; align-self: end; gap: 8px; }.review-actions :deep(.n-button) { min-width: 70px; }
.review-inspector { display: flex; min-height: 0; flex-direction: column; overflow: auto; background: #fffdf9; }.review-inspector > header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid #eee9e1; }.review-inspector > header h2 { margin: 0; font-size: 16px; }.review-inspector > header button { width: 28px; height: 28px; border: 0; background: transparent; color: #6a7485; cursor: pointer; font-size: 22px; }.inspector-section { padding: 16px 18px; border-bottom: 1px solid #eee9e1; }.inspector-section h3, .inspector-note h3 { margin: 0 0 12px; font-size: 14px; }.inspector-section dl { display: grid; gap: 11px; margin: 0; }.inspector-section dl div { display: grid; grid-template-columns: 76px 1fr; gap: 9px; font-size: 12px; }.inspector-section dt { color: #7c8798; }.inspector-section dd { overflow: hidden; margin: 0; color: #46546a; text-overflow: ellipsis; white-space: nowrap; }.author-head { display: flex; align-items: center; gap: 10px; }.author-avatar { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 50%; background: linear-gradient(135deg, #2f3e71, #607ab5); color: #fff; font-weight: 700; }.author-head strong, .author-head small { display: block; }.author-head strong { color: #31415d; font-size: 14px; }.author-head small { margin-top: 4px; color: #8590a0; font-size: 12px; }.inspector-section h4 { margin: 0 0 8px; color: #2b3a54; font-size: 14px; }.article-preview { display: -webkit-box; overflow: hidden; margin: 0; color: #66758a; font-size: 13px; line-height: 1.75; -webkit-box-orient: vertical; -webkit-line-clamp: 6; }.inspector-note { padding: 16px 18px; }.inspector-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: auto; padding: 16px 18px; border-top: 1px solid #eee9e1; }.inspector-actions :deep(.n-button:last-child) { grid-column: span 2; }.inspector-empty { display: grid; flex: 1; align-content: center; justify-items: center; padding: 30px; text-align: center; }.inspector-empty i { position: relative; width: 76px; height: 76px; border: 1px solid #dbe2ec; border-radius: 50%; }.inspector-empty i::before, .inspector-empty i::after { position: absolute; border-radius: 50%; content: ''; }.inspector-empty i::before { top: 16px; left: 20px; width: 12px; height: 12px; background: #eaa35e; }.inspector-empty i::after { right: 18px; bottom: 14px; width: 8px; height: 8px; background: #637fb7; }.inspector-empty h3 { margin: 15px 0 7px; color: #33425e; font-size: 15px; }.inspector-empty p, .decision-hint { margin: 0; color: #7c8797; font-size: 12px; line-height: 1.65; }
@media (max-width: 1120px) { .content-review-page { grid-template-columns: 1fr; height: auto; min-height: 100%; overflow: visible; }.review-main { min-height: 720px; border-right: 0; }.review-inspector { min-height: 430px; }.review-actions { flex-wrap: wrap; justify-content: end; } }
@media (max-width: 680px) { .review-main { padding: 16px 12px; }.review-heading p { display: block; margin: 5px 0 0; }.review-filter { grid-template-columns: 1fr; }.review-item { grid-template-columns: 72px 1fr; min-height: 120px; gap: 12px; }.review-thumb { width: 72px; height: 92px; }.review-actions { grid-column: span 2; justify-content: stretch; }.review-actions :deep(.n-button) { flex: 1; min-width: 0; }.review-tabs { gap: 12px; }.review-tabs button { padding-inline: 5px; } }
</style>
