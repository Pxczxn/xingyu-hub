<template>
  <div class="guides-page page-container page-container--scroll">
    <header class="admin-page-heading">
      <div><p class="admin-page-heading__kicker">KNOWLEDGE BASE</p><h1>指南运营</h1><span class="admin-page-heading__description">维护新手文档、创作规范和社区规则。</span></div>
      <div class="admin-page-heading__actions">
        <span class="guide-count">{{ visiblePages.length }} 篇指南</span>
        <n-button type="primary" class="page-header-action" @click="openCreate">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          新建指南页
        </n-button>
      </div>
    </header>

    <n-card :bordered="false" class="page-list-card">
      <div class="page-list-body">
        <n-space class="toolbar-row" :size="12">
          <n-input v-model:value="keyword" clearable placeholder="搜索标题或别名" style="width: 220px" />
          <n-button secondary @click="load">查询</n-button>
        </n-space>

        <n-data-table
          v-if="visiblePages.length || loading"
          v-bind="tableListProps(tableScrollX(5, 880))"
          :flex-height="true"
          :columns="columns"
          :data="visiblePages"
          :loading="loading"
        />
        <EmptyState v-else title="暂未创建指南" description="创建第一篇指南，为新用户、创作者和星系成员提供明确指引。" />
      </div>
    </n-card>

    <n-modal v-model:show="showModal" preset="card" :title="editing ? '编辑指南' : '新建指南'" style="width: 640px">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="80">
        <n-form-item label="标题" path="title"><n-input v-model:value="form.title" /></n-form-item>
        <n-form-item label="别名" path="slug"><n-input v-model:value="form.slug" :disabled="!!editing" placeholder="如 getting-started" /></n-form-item>
        <n-form-item label="排序"><n-input-number v-model:value="form.sortOrder" :min="0" /></n-form-item>
        <n-form-item label="正文" path="body"><n-input v-model:value="form.body" type="textarea" :rows="8" /></n-form-item>
        <n-form-item v-if="editing" label="状态">
          <n-select v-model:value="form.status" :options="statusOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { guidePageApi, type GuidePage } from '@/api/guide-pages'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { COMMON_CONTENT_STATUS_META } from '@/utils/community-display'
import { renderEditAction, renderStatusTag, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInst | null>(null)
const pages = ref<GuidePage[]>([])
const keyword = ref('')
const showModal = ref(false)
const editing = ref<GuidePage | null>(null)
const form = ref({ title: '', slug: '', body: '', sortOrder: 0, status: 'PUBLISHED' })
const rules: FormRules = {
  title: [{ required: true, message: '请输入标题', trigger: ['input', 'blur'] }],
  slug: [{ required: true, message: '请输入别名', trigger: ['input', 'blur'] }],
  body: [{ required: true, message: '请输入正文', trigger: ['input', 'blur'] }]
}
const statusOptions = [
  { label: '已发布', value: 'PUBLISHED' },
  { label: '草稿', value: 'DRAFT' },
  { label: '已归档', value: 'ARCHIVED' }
]

const { showDetail, detailTitle, detailFields, openLocalContent } = useContentDetailDrawer()

const visiblePages = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return pages.value
  return pages.value.filter(
    (page) =>
      page.title.toLowerCase().includes(q) ||
      page.slug.toLowerCase().includes(q) ||
      page.body?.toLowerCase().includes(q)
  )
})

const columns: DataTableColumns<GuidePage> = [
  {
    title: '标题',
    key: 'title',
    ...colLayout('title'),
    render: (row) => renderTableLink(row.title || '(未命名)', () => openLocalContent(row, row.title))
  },
  { title: '别名', key: 'slug', ...colLayout('slug'), render: (row) => cellText(row.slug) },
  { title: '排序', key: 'sortOrder', ...colLayout('sort'), render: (row) => cellText(row.sortOrder) },
  {
    title: '状态',
    key: 'status',
    ...colLayout('status'),
    render: (row) => renderStatusTag(row.status, COMMON_CONTENT_STATUS_META)
  },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action1'),
    render: (row) => renderTableActionCell([renderEditAction(() => openEdit(row))])
  }
]

async function load() {
  loading.value = true
  try {
    pages.value = await guidePageApi.list()
  } catch {
    message.error('指南暂时无法加载，请检查服务连接后重试')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { title: '', slug: '', body: '', sortOrder: 0, status: 'PUBLISHED' }
  showModal.value = true
}

function openEdit(row: GuidePage) {
  editing.value = row
  form.value = { title: row.title, slug: row.slug, body: row.body, sortOrder: row.sortOrder, status: row.status }
  showModal.value = true
}

async function save() {
  try { await formRef.value?.validate() } catch { return }
  saving.value = true
  try {
    const payload = { ...form.value, sortOrder: String(form.value.sortOrder) }
    if (editing.value) {
      await guidePageApi.update(editing.value.id, payload as any)
    } else {
      await guidePageApi.create(payload as any)
    }
    message.success('保存成功')
    showModal.value = false
    await load()
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  const guideId = route.params.guideId as string | undefined
  const guide = pages.value.find(item => item.id === guideId)
  if (guide) openEdit(guide)
})
</script>

<style scoped>
.guides-page { display: flex; flex-direction: column; gap: 16px; }
.guide-count { color: var(--admin-ink-soft); font-size: 13px; white-space: nowrap; }
</style>
