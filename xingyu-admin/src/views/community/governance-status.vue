<template>
  <div class="page-container">
    <header class="governance-header">
      <div>
        <p class="eyebrow">COMMUNITY GOVERNANCE</p>
        <h1>{{ title }}</h1>
        <p class="header-copy">集中查看待处理事项，打开记录即可查看关联内容和提交处理意见。</p>
      </div>
      <div class="governance-header-actions">
        <div class="queue-stat"><strong>{{ items.length }}</strong><span>当前记录</span></div>
        <div class="queue-stat queue-stat--warm"><strong>{{ pendingCount }}</strong><span>待处理</span></div>
        <n-button secondary :loading="loading" @click="load">刷新队列</n-button>
      </div>
    </header>
    <n-card class="page-list-card governance-card">
      <div class="page-list-body">
      <n-alert v-if="error" type="error" style="margin-bottom:12px">{{ error }} <n-button text type="primary" @click="load">重试</n-button></n-alert>
      <n-data-table v-if="items.length || loading" v-bind="tableListProps(tableScrollX(isAppeal ? 5 : 6, 960))" :flex-height="true" :columns="columns" :data="items" :loading="loading" />
      <EmptyState v-else title="暂无待处理队列" description="当前队列为空或接口暂不可用。" />
      </div>
    </n-card>
    <n-modal
      v-model:show="modal"
      preset="dialog"
      :title="modalTitle"
      positive-text="提交"
      negative-text="取消"
      :positive-button-props="{ loading: saving }"
      @positive-click="submit"
    >
      <n-input v-model:value="comment" type="textarea" placeholder="填写处理意见（可选）" :rows="4" />
    </n-modal>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />
    <RecordDetailDrawer v-model:show="showObjectDetail" title="关联内容" :fields="objectDetailFields" />
    <AuthorDetailDrawer v-model:show="showAuthor" :author="selectedAuthor" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAlert, NButton, NInput, NModal, useMessage, type DataTableColumns } from 'naive-ui'
import request from '@/utils/request'
import EmptyState from '@/components/EmptyState.vue'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import AuthorDetailDrawer from '@/components/community/AuthorDetailDrawer.vue'
import { useAuthorDetailDrawer, useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { buildDetailFields, formatAuthorLabel, formatObjectType, resolveStatusLabel } from '@/utils/community-display'
import { renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

interface QueueItem {
  id: string
  objectType?: string
  objectId?: string
  reporterId?: string
  appellantId?: string
  reason?: string
  detail?: string
  body?: string
  status?: string
  createdAt?: string
  authorDisplayName?: string
  authorUsername?: string
  authorLabel?: string
  authorEmail?: string
  authorBio?: string
}

const props = defineProps<{ title: string }>()
const route = useRoute()
const message = useMessage()
const items = ref<QueueItem[]>([])
const loading = ref(false)
const error = ref('')
const modal = ref(false)
const selected = ref<QueueItem | null>(null)
const decision = ref('')
const comment = ref('')
const saving = ref(false)
const pendingCount = computed(() => items.value.filter((row) => !['DECIDED', 'CLOSED', 'DISMISSED', 'REJECTED'].includes(row.status || '')).length)

const isAppeal = computed(() => route.path.endsWith('/appeals'))

const modalTitle = computed(() => {
  if (isAppeal.value) {
    return decision.value === 'APPROVED' ? '批准申诉' : '驳回申诉'
  }
  return decision.value === 'UPHELD' ? '认定违规' : '驳回举报'
})

const { showDetail, detailTitle, detailFields, openRemoteContent } = useContentDetailDrawer()
const { showAuthor, selectedAuthor, openAuthor } = useAuthorDetailDrawer()
const showObjectDetail = ref(false)
const objectDetailFields = ref<Array<{ label: string; value: string; multiline?: boolean }>>([])

function openItemDetail(row: QueueItem) {
  detailTitle.value = isAppeal.value ? '申诉详情' : '举报详情'
  detailFields.value = buildDetailFields([
    { label: '编号', value: row.id },
    { label: '对象类型', value: formatObjectType(row.objectType) },
    { label: '对象 ID', value: row.objectId },
    { label: '举报原因', value: row.reason, multiline: true },
    { label: '详情', value: row.detail, multiline: true },
    { label: '申诉内容', value: row.body, multiline: true },
    { label: '状态', value: resolveStatusLabel(row.status).label },
    { label: '提交时间', value: row.createdAt }
  ])
  showDetail.value = true
}

async function openObjectContent(row: QueueItem) {
  if (!row.objectType || !row.objectId) return
  const supported = ['ARTICLE', 'MOMENT', 'SERIES']
  if (!supported.includes(row.objectType)) {
    objectDetailFields.value = buildDetailFields([
      { label: '对象类型', value: formatObjectType(row.objectType) },
      { label: '对象 ID', value: row.objectId }
    ])
    showObjectDetail.value = true
    return
  }
  await openRemoteContent(row.objectType, row.objectId, undefined, { missingTitle: '关联内容' })
}

function openReporter(row: QueueItem) {
  const authorId = row.reporterId || row.appellantId
  if (!authorId) return
  openAuthor({
    authorId,
    authorDisplayName: row.authorDisplayName,
    authorUsername: row.authorUsername,
    authorLabel: row.authorLabel,
    authorEmail: row.authorEmail,
    authorBio: row.authorBio
  })
}

const columns = computed<DataTableColumns<QueueItem>>(() => {
  const base: DataTableColumns<QueueItem> = [
    {
      title: '编号',
      key: 'id',
      ...colLayout('uuid'),
      render: (row) => renderTableLink(row.id, () => openItemDetail(row))
    },
    {
      title: '对象类型',
      key: 'objectType',
      ...colLayout('type'),
      render: (row) => formatObjectType(row.objectType)
    },
    {
      title: '对象 ID',
      key: 'objectId',
      ...colLayout('objectId'),
      render: (row) => row.objectId ? renderTableLink(row.objectId, () => openObjectContent(row)) : '—'
    }
  ]

  if (!isAppeal.value) {
    base.push({
      title: '举报人',
      key: 'reporterId',
      ...colLayout('author'),
      render: (row) => {
        const label = formatAuthorLabel(row.authorDisplayName, row.authorUsername, row.authorLabel || row.reporterId)
        if (label === '-') return '—'
        return renderTableLink(label, () => openReporter(row))
      }
    })
  }

  base.push(
    {
      title: '状态',
      key: 'status',
      ...colLayout('status'),
      render: (row) => renderStatusTag(row.status)
    },
    { title: '提交时间', key: 'createdAt', ...colLayout('datetime'), render: (row) => cellText(row.createdAt) },
    {
      title: '操作',
      key: 'actions',
      ...colLayout('action2'),
      render: (row) => {
        if (isAppeal.value) {
          return renderTableActionCell([
            renderTableActionButton('批准', () => openDecision(row, 'APPROVED'), {
              type: 'primary',
              disabled: saving.value || row.status === 'DECIDED'
            }),
            renderTableActionButton('驳回', () => openDecision(row, 'REJECTED'), {
              disabled: saving.value || row.status === 'DECIDED'
            })
          ])
        }
        return renderTableActionCell([
          renderTableActionButton('认定违规', () => openDecision(row, 'UPHELD'), {
            type: 'error',
            disabled: saving.value || row.status === 'CLOSED'
          }),
          renderTableActionButton('驳回', () => openDecision(row, 'DISMISSED'), {
            disabled: saving.value || row.status === 'CLOSED'
          })
        ])
      }
    }
  )

  return base
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const endpoint = route.path.endsWith('/appeals')
      ? '/moderation/appeals'
      : route.path.endsWith('/groups')
        ? '/operations/groups'
        : '/moderation/reports'
    items.value = await request({ url: endpoint, method: 'get', params: { limit: 100 } })
  } catch {
    error.value = `${props.title}加载失败`
  } finally {
    loading.value = false
  }
}

function openDecision(row: QueueItem, next: string) {
  selected.value = row
  decision.value = next
  comment.value = ''
  modal.value = true
}

async function submit() {
  if (!selected.value || saving.value) return
  saving.value = true
  try {
    const kind = route.path.endsWith('/appeals') ? 'appeals' : 'reports'
    await request({
      url: `/moderation/${kind}/${selected.value.id}/decide`,
      method: 'post',
      data: { decision: decision.value, comment: comment.value || undefined }
    })
    modal.value = false
    message.success('处理成功')
    await load()
  } catch {
    message.error('处理失败，请刷新后重试')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.governance-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 2px 2px 8px;
}

.eyebrow {
  margin: 0 0 5px;
  color: #c1894b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
}

.governance-header h1 {
  margin: 0;
  color: #1b2d4e;
  font-size: 24px;
  line-height: 1.25;
}

.header-copy {
  margin: 6px 0 0;
  color: #748198;
  font-size: 13px;
}

.governance-header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.queue-stat {
  display: grid;
  gap: 2px;
  min-width: 64px;
  padding-right: 16px;
  border-right: 1px solid #e2e7ef;
}

.queue-stat strong {
  color: #253756;
  font-size: 20px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.queue-stat span {
  color: #7c879a;
  font-size: 11px;
}

.queue-stat--warm strong {
  color: #d87732;
}

.governance-card {
  flex: 1;
  min-height: 0;
}

@media (max-width: 720px) {
  .governance-header,
  .governance-header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .governance-header-actions {
    gap: 10px;
  }

  .queue-stat {
    border-right: 0;
    border-bottom: 1px solid #e2e7ef;
    padding: 0 0 8px;
  }
}
</style>
