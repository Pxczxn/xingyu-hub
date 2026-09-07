<template>
  <main class="case-workbench">
    <section class="case-list-pane">
      <header class="case-heading"><div><h1>举报处理</h1><p>集中处理社区举报与风险线索</p></div><n-button secondary size="small" :loading="loading" @click="load">刷新案件</n-button></header>
      <nav class="case-tabs"><button class="is-active" type="button">待处理 <b>{{ openCases.length }}</b></button><button type="button" disabled>处理完成</button><button type="button" disabled>全部案件</button></nav>
      <div class="case-filters" role="search"><n-select v-model:value="objectFilter" :options="objectOptions" clearable placeholder="全部类型" /><n-input v-model:value="keyword" clearable placeholder="搜索举报原因 / 对象 ID" /><n-button tertiary @click="keyword = ''; objectFilter = null">重置</n-button></div>
      <n-alert v-if="error" type="error" :show-icon="true">{{ error }} <n-button text type="primary" @click="load">重试</n-button></n-alert>
      <section v-if="filteredCases.length || loading" class="case-list" :aria-busy="loading">
        <article v-for="(item, index) in filteredCases" :key="item.id" class="case-row" :class="{ 'is-selected': selected?.id === item.id }" @click="selected = item">
          <div class="case-mark" :class="'case-mark--' + index % 4"><span>{{ objectLabel(item.objectType).slice(0, 1) }}</span></div>
          <div class="case-copy"><h2>{{ objectLabel(item.objectType) }} · {{ item.objectId }}</h2><p>{{ item.reason || '未提供举报原因' }}</p><small>案件：{{ item.id }}　·　{{ item.createdAt || '暂未记录' }}</small></div>
          <div class="case-priority" :class="{ 'case-priority--open': item.status === 'OPEN' }"><span>{{ statusLabel(item.status) }}</span><b>{{ item.status === 'OPEN' ? '待处理' : '已处理' }}</b></div>
        </article>
      </section>
      <EmptyState v-else-if="!error" title="当前没有待处理治理案件" description="新的举报和风控线索会在这里进入处置流程。" />
    </section>

    <aside class="case-detail-pane" aria-label="举报详情">
      <header><h2>举报详情</h2><button type="button" aria-label="关闭举报详情" @click="selected = null">×</button></header>
      <template v-if="selected">
        <section class="case-subject"><div class="subject-avatar">{{ objectLabel(selected.objectType).slice(0, 1) }}</div><div><h3>{{ objectLabel(selected.objectType) }}</h3><p>对象 ID：{{ selected.objectId }}</p></div></section>
        <section class="case-grid"><dl><div><dt>举报对象</dt><dd>{{ objectLabel(selected.objectType) }}</dd></div><div><dt>举报原因</dt><dd>{{ selected.reason || '未提供' }}</dd></div><div><dt>案件状态</dt><dd><n-tag :type="selected.status === 'OPEN' ? 'warning' : 'success'" size="small">{{ statusLabel(selected.status) }}</n-tag></dd></div><div><dt>创建时间</dt><dd>{{ selected.createdAt || '暂未记录' }}</dd></div></dl></section>
        <section class="case-block"><h3>处理时间线</h3><ol class="case-timeline"><li><b>举报提交</b><small>{{ selected.createdAt || '暂未记录' }}</small><p>案件已进入社区治理队列。</p></li><li><b>等待人工处理</b><small>{{ selected.status === 'OPEN' ? '当前状态' : '已完成' }}</small><p>{{ selected.status === 'OPEN' ? '等待运营人员作出处理决定。' : '该案件已完成处理。' }}</p></li></ol></section>
        <section class="case-block"><h3>处理操作</h3><div class="case-actions"><n-button type="error" ghost :disabled="selected.status !== 'OPEN'" @click="openDecision(selected.id, 'UPHELD')">认定违规</n-button><n-button :disabled="selected.status !== 'OPEN'" @click="openDecision(selected.id, 'DISMISSED')">驳回举报</n-button></div><n-input v-model:value="comment" type="textarea" :rows="3" placeholder="填写处理备注（可选）" /></section>
      </template>
      <section v-else class="case-empty"><i aria-hidden="true"></i><h3>选择一个举报案件</h3><p>案件对象、原因和处置操作会显示在这里。</p></section>
    </aside>
    <n-modal v-model:show="modal" preset="dialog" title="提交治理决定" positive-text="提交" negative-text="取消" :positive-button-props="{ loading: deciding }" @positive-click="decide"><p class="decision-hint">本次操作：{{ selectedDecision === 'UPHELD' ? '认定违规' : '驳回举报' }}</p><n-input v-model:value="comment" type="textarea" placeholder="填写处理意见与措施（可选）" :rows="4" /></n-modal>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NAlert, NInput, NModal, useMessage } from 'naive-ui'
import { moderationApi, type ModerationCase } from '@/api/moderation'
import EmptyState from '@/components/EmptyState.vue'
import { formatObjectType, resolveStatusLabel } from '@/utils/community-display'

const message = useMessage()
const loading = ref(false)
const deciding = ref(false)
const cases = ref<ModerationCase[]>([])
const selected = ref<ModerationCase | null>(null)
const error = ref('')
const keyword = ref('')
const objectFilter = ref<string | null>(null)
const modal = ref(false)
const selectedId = ref<string | null>(null)
const selectedDecision = ref<'UPHELD' | 'DISMISSED'>('UPHELD')
const comment = ref('')

const openCases = computed(() => cases.value.filter(item => item.status === 'OPEN'))
const objectOptions = computed(() => Array.from(new Set(cases.value.map(item => item.objectType))).map(value => ({ label: objectLabel(value), value })))
const filteredCases = computed(() => cases.value.filter(item => {
  const query = keyword.value.trim().toLowerCase()
  return (!objectFilter.value || item.objectType === objectFilter.value) && (!query || [item.reason, item.objectId, item.id, objectLabel(item.objectType)].some(value => value?.toLowerCase().includes(query)))
}))
function objectLabel(type: string) { return formatObjectType(type) }
function statusLabel(status: string) { return resolveStatusLabel(status).label }
async function load() {
  loading.value = true
  try { error.value = ''; cases.value = await moderationApi.listCases(); selected.value = cases.value[0] || null }
  catch { error.value = '加载案件失败'; cases.value = []; selected.value = null }
  finally { loading.value = false }
}
function openDecision(caseId: string, next: 'UPHELD' | 'DISMISSED') { selectedId.value = caseId; selectedDecision.value = next; modal.value = true }
async function decide() {
  if (!selectedId.value || deciding.value) return
  deciding.value = true
  try { await moderationApi.decide(selectedId.value, selectedDecision.value, comment.value || undefined); modal.value = false; message.success('案件已处理'); await load() }
  catch { message.error('操作失败，请稍后重试') } finally { deciding.value = false }
}
onMounted(load)
</script>

<style scoped lang="scss">
.case-workbench { display: grid; grid-template-columns: minmax(460px, .95fr) minmax(520px, 1.15fr); height: 100%; min-height: 0; overflow: hidden; background: #fbfaf7; color: #202e45; }.case-list-pane { display: flex; min-height: 0; flex-direction: column; padding: 20px 18px; border-right: 1px solid #ede8e1; }.case-heading { display: flex; align-items: end; justify-content: space-between; padding: 0 2px; }.case-heading h1 { margin: 0; font-size: 26px; }.case-heading p { margin: 5px 0 0; color: #768297; font-size: 13px; }.case-tabs { display: flex; gap: 28px; margin-top: 22px; border-bottom: 1px solid #ece6de; }.case-tabs button { border: 0; border-bottom: 2px solid transparent; padding: 0 8px 12px; background: transparent; color: #68748a; cursor: pointer; font-size: 14px; }.case-tabs .is-active { border-color: #ed7e29; color: #e46f1a; font-weight: 650; }.case-tabs button:disabled { cursor: default; }.case-tabs b { margin-left: 5px; border-radius: 12px; background: #fff0e5; padding: 2px 6px; font-size: 11px; }.case-filters { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 10px; padding: 14px 0; }.case-list { display: grid; gap: 0; overflow: auto; border: 1px solid #ede8e1; border-radius: 10px; background: rgb(255 255 255 / .85); }.case-row { display: grid; grid-template-columns: 48px minmax(0, 1fr) 72px; align-items: center; gap: 12px; min-height: 94px; padding: 12px 14px; border-bottom: 1px solid #f0ece5; cursor: pointer; }.case-row:last-child { border-bottom: 0; }.case-row.is-selected { background: linear-gradient(90deg, #fff8ec, #fffcf7); outline: 1px solid #efac66; outline-offset: -1px; }.case-mark, .subject-avatar { display: grid; place-items: center; border-radius: 9px; background: linear-gradient(145deg, #15264a, #344a7b); color: #fff; font-weight: 700; }.case-mark { width: 48px; height: 48px; }.case-mark--1 { background: linear-gradient(145deg, #98b5db, #5c7fae); }.case-mark--2 { background: linear-gradient(145deg, #d8a07a, #774c5d); }.case-mark--3 { background: linear-gradient(145deg, #586173, #202b3e); }.case-copy { min-width: 0; }.case-copy h2 { overflow: hidden; margin: 0 0 5px; color: #26354e; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }.case-copy p { overflow: hidden; margin: 0 0 5px; color: #5e6c81; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }.case-copy small { color: #929bab; font-size: 11px; }.case-priority { display: grid; justify-items: end; gap: 8px; color: #617086; font-size: 12px; }.case-priority b { color: #6386c8; font-size: 12px; }.case-priority--open b { color: #e9822e; }
.case-detail-pane { display: flex; min-height: 0; flex-direction: column; overflow: auto; background: #fffdf9; }.case-detail-pane > header { display: flex; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #eee9e1; }.case-detail-pane > header h2 { margin: 0; font-size: 17px; }.case-detail-pane > header button { border: 0; background: transparent; color: #687489; cursor: pointer; font-size: 22px; }.case-subject { display: flex; align-items: center; gap: 12px; padding: 18px 22px; border-bottom: 1px solid #eee9e1; }.subject-avatar { width: 58px; height: 58px; border-radius: 10px; font-size: 20px; }.case-subject h3 { margin: 0 0 5px; font-size: 16px; }.case-subject p { margin: 0; color: #7d8799; font-size: 12px; }.case-grid { padding: 17px 22px; border-bottom: 1px solid #eee9e1; }.case-grid dl { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; margin: 0; }.case-grid dl div { min-width: 0; }.case-grid dt { margin-bottom: 5px; color: #8690a0; font-size: 12px; }.case-grid dd { overflow: hidden; margin: 0; color: #4e5b70; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }.case-block { padding: 17px 22px; border-bottom: 1px solid #eee9e1; }.case-block h3 { margin: 0 0 12px; font-size: 14px; }.case-timeline { display: grid; gap: 15px; margin: 0; padding: 0 0 0 18px; border-left: 1px solid #dfe5ee; list-style: none; }.case-timeline li { position: relative; }.case-timeline li::before { position: absolute; top: 5px; left: -23px; width: 9px; height: 9px; border-radius: 50%; background: #4b81d1; content: ''; }.case-timeline li:last-child::before { background: #e89a41; }.case-timeline b, .case-timeline small { display: block; }.case-timeline b { color: #3d4d67; font-size: 13px; }.case-timeline small, .case-timeline p { color: #8791a0; font-size: 12px; }.case-timeline p { margin: 3px 0 0; }.case-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }.case-empty { display: grid; flex: 1; align-content: center; justify-items: center; padding: 28px; text-align: center; }.case-empty i { position: relative; width: 74px; height: 74px; border: 1px solid #dce4ef; border-radius: 50%; }.case-empty i::before { position: absolute; top: 21px; left: 31px; width: 10px; height: 10px; border-radius: 50%; background: #e8994d; content: ''; }.case-empty h3 { margin: 15px 0 6px; color: #34435f; font-size: 15px; }.case-empty p, .decision-hint { margin: 0; color: #8892a1; font-size: 12px; }
@media (max-width: 1050px) { .case-workbench { grid-template-columns: 1fr; height: auto; min-height: 100%; overflow: visible; }.case-list-pane { min-height: 640px; border-right: 0; }.case-detail-pane { min-height: 560px; } } @media (max-width: 600px) { .case-list-pane { padding: 16px 12px; }.case-filters { grid-template-columns: 1fr; }.case-row { grid-template-columns: 42px minmax(0, 1fr); }.case-mark { width: 42px; height: 42px; }.case-priority { grid-column: 2; justify-items: start; grid-template-columns: auto auto; }.case-grid dl { grid-template-columns: 1fr; gap: 12px; } }
</style>
