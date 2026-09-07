<template>
  <div class="announcements-page page-container page-container--scroll">
    <header class="admin-page-heading">
      <div><p class="admin-page-heading__kicker">COMMUNITY NOTICE</p><h1>公告中心</h1><span class="admin-page-heading__description">发布并维护面向社区成员的官方信息。</span></div>
      <div class="admin-page-heading__actions"><span class="notice-count">{{ items.length }} 条公告</span><n-button secondary :loading="loading" @click="load">刷新</n-button><n-button type="primary" @click="openCreate">发布公告</n-button></div>
    </header>
    <n-card :bordered="false" class="page-list-card">
      <div class="page-list-body">
        <n-data-table
          v-if="items.length || loading"
          v-bind="tableListProps(tableScrollX(4, 880))"
          :flex-height="true"
          :columns="columns"
          :data="items"
          :loading="loading"
        />
        <EmptyState v-else title="还没有公告" description="发布第一条公告后，社区成员会在公告中心看到这条消息。" />
      </div>
    </n-card>
    <n-modal v-model:show="show" preset="card" title="发布公告" style="width:560px">
      <n-form :model="form">
        <n-form-item label="标题"><n-input v-model:value="form.title" /></n-form-item>
        <n-form-item label="正文"><n-input v-model:value="form.body" type="textarea" :rows="6" /></n-form-item>
      </n-form>
      <template #footer>
        <n-button @click="show = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="create">发布</n-button>
      </template>
    </n-modal>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage, type DataTableColumns } from 'naive-ui'
import { announcementApi, type Announcement } from '@/api/announcements'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { ANNOUNCEMENT_STATUS_META } from '@/utils/community-display'
import { renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const items = ref<Announcement[]>([])
const show = ref(false)
const form = ref({ title: '', body: '' })

const { showDetail, detailTitle, detailFields, openLocalContent } = useContentDetailDrawer()
function openCreate() { form.value = { title: '', body: '' }; show.value = true }

const columns: DataTableColumns<Announcement> = [
  {
    title: '标题',
    key: 'title',
    ...colLayout('title'),
    render: (row) => renderTableLink(row.title || '(未命名)', () => openLocalContent(row, row.title))
  },
  {
    title: '状态',
    key: 'status',
    ...colLayout('status'),
    render: (row) => renderStatusTag(row.status, ANNOUNCEMENT_STATUS_META)
  },
  { title: '发布时间', key: 'publishedAt', ...colLayout('datetime'), render: (row) => cellText(row.publishedAt) },
  { title: '创建时间', key: 'createdAt', ...colLayout('datetime'), render: (row) => cellText(row.createdAt) },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action2'),
    render: (row) =>
      renderTableActionCell([
        renderTableActionButton('下线', () => updateStatus(row.id, 'DRAFT'), {
          disabled: row.status !== 'PUBLISHED'
        }),
        renderTableActionButton('归档', () => updateStatus(row.id, 'ARCHIVED'), {
          disabled: row.status === 'ARCHIVED'
        })
      ])
  }
]

async function load() {
  loading.value = true
  try {
    items.value = await announcementApi.list()
  } catch {
    message.error('加载公告失败')
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.title.trim()) {
    message.warning('请输入标题')
    return
  }
  saving.value = true
  try {
    await announcementApi.create({ title: form.value.title, body: form.value.body })
    message.success('发布成功')
    show.value = false
    form.value = { title: '', body: '' }
    await load()
  } catch {
    message.error('发布失败')
  } finally {
    saving.value = false
  }
}

async function updateStatus(id: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED') {
  try {
    await announcementApi.updateStatus(id, status)
    message.success('状态已更新')
    await load()
  } catch {
    message.error('更新失败')
  }
}

onMounted(load)
</script>

<style scoped>
.announcements-page { display: flex; flex-direction: column; gap: 16px; }
.notice-count { color: var(--admin-ink-soft); font-size: 13px; white-space: nowrap; }
</style>
