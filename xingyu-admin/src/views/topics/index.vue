<template>
  <div class="page-container page-container--scroll topic-page">
    <header class="admin-page-heading">
      <div><p class="admin-page-heading__kicker">CONTENT TAXONOMY</p><h1>话题运营</h1><span class="admin-page-heading__description">维护社区话题的介绍、层级、别名与内容聚合入口。</span></div>
      <div class="admin-page-heading__actions">
        <span class="topic-count">{{ topics.length }} 个话题</span>
        <n-button secondary :loading="loading" @click="loadTopics">刷新</n-button>
        <n-button type="primary" class="page-header-action" @click="openCreate">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          新建话题
        </n-button>
      </div>
    </header>

    <n-card :bordered="false" class="page-list-card topic-list-card">

      <div class="page-list-body">
        <n-space class="topic-filters" :size="12" :wrap="false">
          <n-input v-model:value="keyword" placeholder="搜索名称或别名" clearable style="width: 260px" @keyup.enter="loadTopics" />
          <n-select
            v-model:value="status"
            :options="statusOptions"
            clearable
            placeholder="状态"
            style="width: 140px"
          />
          <n-button type="primary" secondary @click="loadTopics">
            <template #icon>
              <n-icon><SearchOutline /></n-icon>
            </template>
            查询
          </n-button>
        </n-space>

        <n-data-table
          v-if="topics.length || loading"
          v-bind="tableListProps(tableScrollX(8, 1080))"
          :flex-height="true"
          :columns="columns"
          :data="topics"
          :loading="loading"
        />
        <EmptyState v-else title="暂未找到话题" description="调整筛选条件，或新建一个话题作为社区内容的聚合入口。" />
      </div>
    </n-card>

    <n-modal v-model:show="showModal" preset="card" :title="editing ? '编辑话题' : '新建话题'" style="width: 480px">
      <n-form ref="topicFormRef" :model="form" :rules="topicRules" label-placement="left" label-width="80">
        <n-form-item label="显示名称" path="name">
          <n-input v-model:value="form.name" />
        </n-form-item>
        <n-form-item label="话题介绍">
          <n-input
            v-model:value="form.description"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="简要说明该话题覆盖的范围"
          />
        </n-form-item>
        <n-form-item label="URL 别名" path="slug">
          <n-input v-model:value="form.slug" :disabled="!!editing" />
        </n-form-item>
        <n-form-item v-if="!editing" label="种子键">
          <n-input v-model:value="form.seedKey" placeholder="默认同别名" />
        </n-form-item>
        <n-form-item v-if="editing" label="状态">
          <n-select v-model:value="form.status" :options="statusOptions" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="saveTopic">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />

    <n-modal v-model:show="showGovernance" preset="card" title="话题治理" style="width: 520px">
      <n-space vertical :size="16">
        <n-alert type="info" :bordered="false">
          当前话题：{{ governanceTopic?.name }}（{{ governanceTopic?.slug }}）
        </n-alert>
        <n-form label-placement="left" label-width="88">
          <n-form-item label="父级话题">
            <n-select
              v-model:value="parentTopicId"
              :options="parentOptions"
              clearable
              filterable
              placeholder="选择父级（留空为顶级）"
            />
          </n-form-item>
          <n-form-item label=" ">
            <n-button type="primary" secondary :loading="governanceSaving" @click="saveParent">保存父级</n-button>
          </n-form-item>
        </n-form>
        <n-divider />
        <n-form label-placement="left" label-width="88">
          <n-form-item label="新增别名">
            <n-input-group>
              <n-input v-model:value="newAlias" placeholder="alias-slug" />
              <n-button type="primary" :loading="governanceSaving" @click="addAlias">添加</n-button>
            </n-input-group>
          </n-form-item>
          <n-form-item v-if="aliases.length" label="已有别名">
            <n-space>
              <n-tag v-for="item in aliases" :key="item.id" size="small">{{ item.aliasSlug }}</n-tag>
            </n-space>
          </n-form-item>
        </n-form>
        <n-divider />
        <n-form label-placement="left" label-width="88">
          <n-form-item label="合并到">
            <n-select
              v-model:value="mergeTargetId"
              :options="mergeOptions"
              filterable
              placeholder="选择目标话题"
            />
          </n-form-item>
          <n-form-item label=" ">
            <n-button type="error" secondary :loading="governanceSaving" :disabled="!mergeTargetId" @click="mergeTopic">
              合并话题
            </n-button>
          </n-form-item>
        </n-form>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { AddOutline, SearchOutline } from '@vicons/ionicons5'
import { topicApi, type Topic } from '@/api/topics'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { renderEditAction, renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const route = useRoute()
const loading = ref(false)
const saving = ref(false)
const topicFormRef = ref<FormInst | null>(null)
const topics = ref<Topic[]>([])
const keyword = ref('')
const status = ref<string | null>(null)
const showModal = ref(false)
const editing = ref<Topic | null>(null)
const form = ref({ name: '', slug: '', seedKey: '', status: 'ACTIVE' as Topic['status'], description: '' })
const topicRules: FormRules = {
  name: [{ required: true, message: '请输入显示名称', trigger: ['input', 'blur'] }],
  slug: [
    { required: true, message: '请输入 URL 别名', trigger: ['input', 'blur'] },
    { pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: '仅支持小写字母、数字和连字符', trigger: ['input', 'blur'] }
  ]
}

const showGovernance = ref(false)
const governanceTopic = ref<Topic | null>(null)
const governanceSaving = ref(false)
const parentTopicId = ref<string | null>(null)
const newAlias = ref('')
const aliases = ref<Array<{ id: string; aliasSlug: string }>>([])
const mergeTargetId = ref<string | null>(null)

const parentOptions = computed(() =>
  topics.value
    .filter((t) => t.id !== governanceTopic.value?.id && t.status !== 'MERGED')
    .map((t) => ({ label: `${t.name} (${t.slug})`, value: t.id }))
)

const mergeOptions = computed(() =>
  topics.value
    .filter((t) => t.id !== governanceTopic.value?.id && t.status !== 'MERGED')
    .map((t) => ({ label: `${t.name} (${t.slug})`, value: t.id }))
)

const topicNameById = computed(() => {
  const map = new Map<string, string>()
  for (const topic of topics.value) {
    map.set(topic.id, topic.name)
  }
  return map
})

const { showDetail, detailTitle, detailFields, openLocalContent } = useContentDetailDrawer()

const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'DISABLED' },
  { label: '已合并', value: 'MERGED' }
]

const columns: DataTableColumns<Topic> = [
  {
    title: '名称',
    key: 'name',
    ...colLayout('name'),
    render: (row) => renderTableLink(row.name, () => openLocalContent(row, row.name))
  },
  { title: '别名', key: 'slug', ...colLayout('slug'), render: (row) => cellText(row.slug) },
  {
    title: '父级',
    key: 'parentTopicId',
    ...colLayout('name'),
    render: (row) => cellText(row.parentTopicId ? topicNameById.value.get(row.parentTopicId) || row.parentTopicId : '—')
  },
  {
    title: '介绍',
    key: 'description',
    ...colLayout('summary'),
    render: (row) => cellText(row.description || '—')
  },
  {
    title: '关注',
    key: 'followerCount',
    ...colLayout('number'),
    render: (row) => (row.followerCount == null ? '—' : String(row.followerCount))
  },
  {
    title: '内容',
    key: 'contentCount',
    ...colLayout('number'),
    render: (row) => (row.contentCount == null ? '—' : String(row.contentCount))
  },
  { title: '种子键', key: 'seedKey', ...colLayout('slug'), render: (row) => cellText(row.seedKey) },
  {
    title: '状态',
    key: 'status',
    ...colLayout('status'),
    render: (row) => renderStatusTag(row.status, {
      ACTIVE: { label: '启用', type: 'success' },
      ENABLED: { label: '启用', type: 'success' },
      DISABLED: { label: '停用', type: 'default' },
      MERGED: { label: '已合并', type: 'warning' }
    })
  },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action2'),
    render: (row) =>
      renderTableActionCell([
        renderEditAction(() => openEdit(row)),
        renderTableActionButton('治理', () => openGovernance(row), {
          disabled: row.status === 'MERGED'
        })
      ])
  }
]

async function loadTopics() {
  loading.value = true
  try {
    topics.value = await topicApi.list({
      keyword: keyword.value || undefined,
      status: status.value || undefined
    })
  } catch {
    message.error('加载话题失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.value = { name: '', slug: '', seedKey: '', status: 'ACTIVE', description: '' }
  showModal.value = true
}

function openEdit(topic: Topic) {
  editing.value = topic
  form.value = {
    name: topic.name,
    slug: topic.slug,
    seedKey: topic.seedKey,
    status: topic.status,
    description: topic.description || ''
  }
  showModal.value = true
}

async function saveTopic() {
  try { await topicFormRef.value?.validate() } catch { return }
  saving.value = true
  try {
    if (editing.value) {
      await topicApi.update(editing.value.id, {
        name: form.value.name,
        status: form.value.status,
        description: form.value.description || undefined
      })
      message.success('话题已更新')
    } else {
      await topicApi.create({
        name: form.value.name,
        slug: form.value.slug,
        seedKey: form.value.seedKey || undefined,
        description: form.value.description || undefined
      })
      message.success('话题已创建')
    }
    showModal.value = false
    await loadTopics()
  } catch (err: any) {
    message.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function openGovernance(topic: Topic) {
  governanceTopic.value = topic
  parentTopicId.value = topic.parentTopicId ?? null
  mergeTargetId.value = null
  newAlias.value = ''
  aliases.value = []
  showGovernance.value = true
  try {
    aliases.value = await topicApi.listAliases(topic.id)
  } catch {
    message.warning('别名列表加载失败')
  }
}

async function saveParent() {
  if (!governanceTopic.value) return
  governanceSaving.value = true
  try {
    await topicApi.setParent(governanceTopic.value.id, parentTopicId.value)
    message.success('父级已更新')
    showGovernance.value = false
    await loadTopics()
  } catch (err: any) {
    message.error(err?.message || '设置父级失败')
  } finally {
    governanceSaving.value = false
  }
}

async function addAlias() {
  if (!governanceTopic.value || !newAlias.value.trim()) return
  governanceSaving.value = true
  try {
    await topicApi.addAlias(governanceTopic.value.id, newAlias.value.trim())
    aliases.value = await topicApi.listAliases(governanceTopic.value.id)
    newAlias.value = ''
    message.success('别名已添加')
  } catch (err: any) {
    message.error(err?.message || '添加别名失败')
  } finally {
    governanceSaving.value = false
  }
}

async function mergeTopic() {
  if (!governanceTopic.value || !mergeTargetId.value) return
  governanceSaving.value = true
  try {
    await topicApi.merge(governanceTopic.value.id, mergeTargetId.value)
    message.success('话题已合并')
    showGovernance.value = false
    await loadTopics()
  } catch (err: any) {
    message.error(err?.message || '合并失败')
  } finally {
    governanceSaving.value = false
  }
}

onMounted(async () => {
  await loadTopics()
  const topicId = route.params.topicId as string | undefined
  const topic = topics.value.find(item => item.id === topicId)
  if (!topic) return
  if (route.path.endsWith('/merge')) await openGovernance(topic)
  else openEdit(topic)
})
</script>

<style scoped>
.topic-page { display: flex; flex-direction: column; gap: 16px; }
.topic-count { color: var(--admin-ink-soft); font-size: 13px; white-space: nowrap; }
.topic-list-card { min-height: 480px; }

.topic-filters {
  flex-shrink: 0;
  margin-bottom: 4px;
}
@media (max-width: 640px) {
  .topic-filters { align-items: stretch; flex-direction: column; }
  .topic-filters :deep(.n-input), .topic-filters :deep(.n-select) { width: 100% !important; }
}
</style>
