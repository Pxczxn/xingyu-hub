<template>
  <div class="featured-page page-container page-container--scroll">
    <header class="featured-heading">
      <div>
        <p>COMMUNITY CURATION</p>
        <h1>精选运营</h1>
        <span>维护发现页与首页推荐区域中的人工精选内容。</span>
      </div>
      <div class="featured-actions">
        <span>共 {{ items.length }} 条</span>
        <n-button secondary :loading="loading" @click="load">刷新</n-button>
        <n-button type="primary" @click="openCreate">新增精选</n-button>
      </div>
    </header>

    <n-card :bordered="false" class="page-list-card featured-list-card">
      <div class="page-list-body">
        <n-data-table
          v-if="items.length || loading"
          v-bind="tableListProps(tableScrollX(5, 960))"
          :flex-height="true"
          :columns="columns"
          :data="items"
          :loading="loading"
        />
        <EmptyState v-else title="暂无精选内容" description="仅可引用已进入公开索引的内容。" />
      </div>
    </n-card>

    <n-modal v-model:show="showModal" preset="card" title="新增精选" style="width: 480px">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="left" label-width="90">
        <n-form-item label="类型">
          <n-select v-model:value="form.objectType" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="对象 ID" path="objectId">
          <n-input v-model:value="form.objectId" placeholder="请输入已公开内容的对象 ID" />
        </n-form-item>
        <n-form-item label="排序">
          <n-input-number v-model:value="form.sortOrder" :min="0" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { featuredApi, type FeaturedContent } from '@/api/featured'
import EmptyState from '@/components/EmptyState.vue'
import { formatObjectType } from '@/utils/community-display'
import { renderStatusTag, renderTableActionButton, renderTableActionCell } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const formRef = ref<FormInst | null>(null)
const items = ref<FeaturedContent[]>([])
const showModal = ref(false)
const form = ref({ objectType: 'ARTICLE', objectId: '', sortOrder: 0 })
const typeOptions = [
  { label: '文章', value: 'ARTICLE' },
  { label: '系列', value: 'SERIES' }
]
const rules: FormRules = {
  objectId: [{ required: true, message: '请输入对象 ID', trigger: ['input', 'blur'] }]
}

function openCreate() {
  form.value = { objectType: 'ARTICLE', objectId: '', sortOrder: 0 }
  showModal.value = true
}

const columns: DataTableColumns<FeaturedContent> = [
  { title: '类型', key: 'objectType', ...colLayout('type'), render: (row) => formatObjectType(row.objectType) },
  { title: '对象 ID', key: 'objectId', ...colLayout('objectId'), render: (row) => cellText(row.objectId) },
  { title: '标题', key: 'title', ...colLayout('title'), render: (row) => cellText(row.title || '—') },
  { title: '状态', key: 'status', ...colLayout('status'), render: (row) => renderStatusTag(row.status) },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action1'),
      render: (row) =>
      renderTableActionCell([
        renderTableActionButton('归档', () => archive(row.id), {
          type: 'error',
          disabled: row.status === 'ARCHIVED'
        })
      ])
  }
]

async function load() {
  loading.value = true
  try {
    items.value = await featuredApi.list()
  } catch {
    message.error('精选内容暂时无法加载，请检查服务连接后重试')
  } finally {
    loading.value = false
  }
}

async function save() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    await featuredApi.create(form.value)
    message.success('已添加精选')
    showModal.value = false
    form.value = { objectType: 'ARTICLE', objectId: '', sortOrder: 0 }
    await load()
  } catch {
    message.error('添加失败')
  } finally {
    saving.value = false
  }
}

async function archive(id: string) {
  try {
    await featuredApi.archive(id)
    message.success('已归档')
    await load()
  } catch {
    message.error('归档失败，请稍后重试')
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.featured-page { display: flex; flex-direction: column; gap: 16px; }
.featured-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 2px 2px 0; }
.featured-heading p { margin: 0 0 4px; color: var(--admin-warm); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.featured-heading h1 { margin: 0; color: var(--admin-ink); font-size: 26px; line-height: 1.2; }
.featured-heading span { display: block; margin-top: 6px; color: var(--admin-ink-soft); font-size: 13px; }
.featured-actions { display: flex; align-items: center; gap: 10px; }
.featured-actions > span { margin: 0 4px 0 0; white-space: nowrap; }
.featured-list-card { min-height: 420px; }
.featured-list-card :deep(.n-card__content) { display: flex; min-height: 380px; flex-direction: column; }
.page-list-body { display: flex; min-height: 0; flex: 1; flex-direction: column; }
@media (max-width: 700px) {
  .featured-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
  .featured-actions { width: 100%; flex-wrap: wrap; }
  .featured-actions > span { margin-right: auto; }
}
</style>
