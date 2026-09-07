<template>
  <div class="page-container content-assets-page">
    <header class="asset-heading">
      <div>
        <p class="asset-eyebrow">{{ config.eyebrow }}</p>
        <h1>{{ title }}</h1>
        <span>{{ config.description }}</span>
      </div>
      <div class="asset-heading-actions">
        <div class="asset-count"><strong>{{ total }}</strong><small>条记录</small></div>
        <n-button secondary :loading="loading" @click="load">刷新列表</n-button>
      </div>
    </header>
    <n-alert v-if="config.hint" type="info" :bordered="false" class="page-hint">
      <span>{{ config.hint }}</span>
      <router-link v-if="config.reviewLink" :to="config.reviewLink" class="review-link">前往内容审核</router-link>
    </n-alert>

    <n-card class="page-list-card asset-list-card">
      <div class="page-list-body">
      <n-space class="toolbar" align="center">
        <n-input
          v-model:value="keyword"
          clearable
          :placeholder="config.searchPlaceholder"
          @keyup.enter="load"
        />
        <n-select
          v-model:value="status"
          clearable
          placeholder="全部状态"
          :options="config.statusOptions"
          @update:value="onStatusChange"
        />
        <n-button type="primary" :loading="loading" @click="load">查询</n-button>
      </n-space>

      <n-alert v-if="error" type="error" :title="error" closable @close="error = ''" />

      <n-data-table
        v-if="records.length || loading"
        v-bind="tableListProps(tableScrollX(props.assetType === 'SERIES' ? 7 : 6, 1080))"
        :columns="columns"
        :data="records"
        :loading="loading"
        :row-key="(row) => String(row.id)"
      />
      <EmptyState
        v-else-if="!error"
        :title="`暂无${title}`"
        :description="config.emptyDescription"
      />
      <n-pagination
        v-if="total"
        v-model:page="page"
        v-model:page-size="pageSize"
        class="pagination-container"
        :page-count="Math.ceil(total / pageSize)"
        show-size-picker
        @update:page="load"
        @update:page-size="onPageSizeChange"
      />
      </div>
    </n-card>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />
    <AuthorDetailDrawer v-model:show="showAuthor" :author="selectedAuthor" />
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { NPopconfirm, useMessage, type DataTableColumns } from 'naive-ui'
import { operationsApi, type ContentAsset } from '@/api/operations'
import EmptyState from '@/components/EmptyState.vue'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import AuthorDetailDrawer from '@/components/community/AuthorDetailDrawer.vue'
import { useAuthorDetailDrawer } from '@/composables/useCommunityDrawers'
import { formatAuthorLabel, AUTHOR_COLUMN_TITLE } from '@/utils/community-display'
import { renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'
import {
  findStatusAction,
  formatAssetStatus,
  getContentAssetConfig,
  type ContentAssetScreenConfig
} from './content-asset-config'

const props = defineProps<{ assetType: string; title: string }>()

const message = useMessage()
const loading = ref(false)
const error = ref('')
const records = ref<ContentAsset[]>([])
const keyword = ref('')
const status = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const selected = ref<ContentAsset>()
const showDetail = ref(false)

const { showAuthor, selectedAuthor, openAuthor } = useAuthorDetailDrawer()

const config = computed<ContentAssetScreenConfig>(() => getContentAssetConfig(props.assetType))

const detailTitle = computed(() => {
  if (!selected.value) return '内容详情'
  const label = selected.value.title || selected.value.summary
  return label ? String(label) : '内容详情'
})

const detailFields = computed(() => {
  if (!selected.value) return []
  const row = selected.value
  return config.value.detailFields
    .map((field) => {
      let value = '-'
      if (field.key === 'status') {
        value = formatAssetStatus(config.value, row.status).label
      } else if (field.key === 'authorLabel') {
        value = formatAuthorLabel(row.authorDisplayName, row.authorUsername, row.authorLabel || row.authorName)
      } else {
        const raw = row[field.key]
        if (raw != null && raw !== '') value = String(raw)
      }
      return {
        label: field.label,
        value,
        multiline: field.key === 'body' || field.key === 'summary'
      }
    })
    .filter((field) => field.value !== '-')
})

function openContentDetail(row: ContentAsset) {
  selected.value = row
  showDetail.value = true
}

function openAuthorDetail(row: ContentAsset) {
  if (!row.authorId && !row.authorLabel && !row.authorUsername && !row.authorDisplayName) return
  openAuthor(row)
}

function renderTitleCell(row: ContentAsset) {
  const label =
    props.assetType === 'MOMENT'
      ? row.title || '(无正文)'
      : row.title || '(未命名)'
  return renderTableLink(label, () => openContentDetail(row))
}

function renderAuthorCell(row: ContentAsset) {
  const label = formatAuthorLabel(row.authorDisplayName, row.authorUsername, row.authorLabel || row.authorName)
  if (label === '-') return '-'
  return renderTableLink(label, () => openAuthorDetail(row))
}

const columns = computed<DataTableColumns<ContentAsset>>(() => {
  const screen = config.value
  const base: DataTableColumns<ContentAsset> = []

  if (props.assetType === 'MOMENT') {
    base.push({
      title: '正文摘要',
      key: 'title',
      ...colLayout('title'),
      render: (row) => renderTitleCell(row)
    })
  } else {
    base.push({
      title: '标题',
      key: 'title',
      ...colLayout('title'),
      render: (row) => renderTitleCell(row)
    })
  }

  base.push({
    title: AUTHOR_COLUMN_TITLE,
    key: 'authorLabel',
    ...colLayout('author'),
    render: (row) => renderAuthorCell(row)
  })

  if (props.assetType === 'SERIES') {
    base.push({
      title: '简介',
      key: 'summary',
      ...colLayout('summary'),
      render: (row) => cellText(row.summary)
    })
    base.push({
      title: '章节数',
      key: 'chapterCount',
      ...colLayout('number'),
      render: (row) => (row.chapterCount == null ? '—' : String(row.chapterCount))
    })
  }

  base.push(
    {
      title: '状态',
      key: 'status',
      ...colLayout('status'),
      render: (row) => renderStatusTag(row.status, screen.statusMeta)
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      ...colLayout('datetime'),
      render: (row) => cellText(row.updatedAt)
    },
    {
      title: '操作',
      key: 'actions',
      ...colLayout('action2'),
      render: (row) => {
        const action = findStatusAction(screen, row.status)
        return renderTableActionCell([
          renderTableActionButton('查看详情', () => openContentDetail(row)),
          action
            ? h(
                NPopconfirm,
                { onPositiveClick: () => updateStatus(row, action.to) },
                {
                  trigger: () =>
                    renderTableActionButton(action.label, undefined, {
                      type: action.buttonType || 'default'
                    }),
                  default: () => action.confirm
                }
              )
            : null
        ])
      }
    }
  )

  return base
})

function onStatusChange() {
  page.value = 1
  load()
}

function onPageSizeChange() {
  page.value = 1
  load()
}

async function updateStatus(row: ContentAsset, nextStatus: string) {
  try {
    await operationsApi.updateContentStatus(row.id, {
      type: props.assetType,
      status: nextStatus
    })
    message.success('状态已更新')
    await load()
  } catch (e: any) {
    message.error(e?.message || '状态变更失败，内容未修改')
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await operationsApi.listContent({
      type: props.assetType,
      keyword: keyword.value || undefined,
      status: status.value || undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    records.value = result.records
    total.value = result.total
  } catch (e: any) {
    error.value = e?.message || '内容资产接口暂不可用，请检查权限或后端服务'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.content-assets-page {
  max-width: 1480px;
}

.asset-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 2px 2px 8px;
}

.asset-eyebrow {
  margin: 0 0 5px;
  color: #c1894b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
}

.asset-heading h1 {
  margin: 0;
  color: #1b2d4e;
  font-size: 24px;
  line-height: 1.25;
}

.asset-heading span {
  display: block;
  max-width: 720px;
  margin-top: 6px;
  color: #748198;
  font-size: 13px;
  line-height: 1.5;
}

.asset-heading-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.asset-count {
  display: grid;
  gap: 2px;
  padding-right: 16px;
  border-right: 1px solid #e2e7ef;
}

.asset-count strong {
  color: #253756;
  font-size: 20px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.asset-count small {
  color: #7c879a;
  font-size: 11px;
}

.asset-list-card {
  min-height: 0;
}

.page-hint {
  margin-bottom: 0;
  flex-shrink: 0;
}

.review-link {
  margin-left: 8px;
  color: #6964b8;
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

@media (max-width: 720px) {
  .asset-heading,
  .asset-heading-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .asset-heading-actions {
    gap: 10px;
  }

  .asset-count {
    border-right: 0;
    border-bottom: 1px solid #e2e7ef;
    padding: 0 0 8px;
  }
}
</style>
