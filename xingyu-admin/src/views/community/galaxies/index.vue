<template>
  <div class="galaxies-page page-container page-container--scroll">
    <header class="galaxies-heading">
      <div>
        <p>COMMUNITY STRUCTURE</p>
        <h1>星系运营</h1>
        <span>维护长期协作空间的公开身份与关联内容。</span>
      </div>
      <div class="galaxies-heading__actions">
        <span>{{ galaxies.length }} 个星系</span>
        <n-button type="primary" class="page-header-action" @click="openCreate">
          <template #icon>
            <n-icon><AddOutline /></n-icon>
          </template>
          新建星系
        </n-button>
      </div>
    </header>

    <n-card :bordered="false" class="page-list-card galaxies-list-card">
      <div class="page-list-body">
        <n-space class="toolbar-row" :size="12" align="center">
          <n-select
            v-model:value="selectedSlug"
            :options="galaxyOptions"
            placeholder="选择星系"
            style="width: 260px"
            @update:value="loadContent"
          />
          <n-tag v-if="selectedGalaxy?.official" type="info" :bordered="false">官方星系</n-tag>
          <n-text v-if="selectedGalaxy?.memberCount != null" depth="3">
            {{ selectedGalaxy.memberCount }} 名成员
          </n-text>
          <n-button secondary :disabled="!selectedGalaxy" @click="openEdit">编辑资料</n-button>
          <n-button type="primary" :disabled="!selectedGalaxy" @click="showAdd = true">
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            关联内容
          </n-button>
        </n-space>

        <n-data-table
          v-if="content.length || loading"
          v-bind="tableListProps(tableScrollX(5, 960))"
          :flex-height="true"
          :columns="columns"
          :data="content"
          :loading="loading"
        />
        <EmptyState v-else title="暂未关联内容" description="选择星系后，可将文章或系列关联到这里，形成完整的公开内容版图。" />
      </div>
    </n-card>

    <n-modal v-model:show="showAdd" preset="card" title="关联星系内容" style="width: 480px">
      <n-form ref="contentFormRef" :model="form" :rules="contentRules" label-placement="left" label-width="90">
        <n-form-item label="类型">
          <n-select v-model:value="form.objectType" :options="objectTypeOptions" />
        </n-form-item>
        <n-form-item label="对象 ID" path="objectId">
          <n-input v-model:value="form.objectId" placeholder="已发布内容的 ID" />
        </n-form-item>
        <n-form-item label="置顶">
          <n-switch v-model:value="form.pinned" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAdd = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="addContent">添加</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-modal v-model:show="showGalaxyModal" preset="card" :title="editingGalaxy ? '编辑星系' : '新建星系'" style="width: 480px">
      <n-form ref="galaxyFormRef" :model="galaxyForm" :rules="galaxyRules" label-placement="left" label-width="88">
        <n-form-item label="名称" path="name"><n-input v-model:value="galaxyForm.name" /></n-form-item>
        <n-form-item label="别名" path="slug"><n-input v-model:value="galaxyForm.slug" :disabled="!!editingGalaxy" /></n-form-item>
        <n-form-item v-if="!editingGalaxy" label="种子键">
          <n-input v-model:value="galaxyForm.seedKey" placeholder="默认同别名" />
        </n-form-item>
        <n-form-item label="官方星系"><n-switch v-model:value="galaxyForm.official" /></n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showGalaxyModal = false">取消</n-button>
          <n-button type="primary" :loading="galaxySaving" @click="saveGalaxy">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <RecordDetailDrawer v-model:show="showDetail" :title="detailTitle" :fields="detailFields" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessage, type DataTableColumns, type FormInst, type FormRules } from 'naive-ui'
import { AddOutline } from '@vicons/ionicons5'
import { galaxyApi, type Galaxy, type GalaxyContent } from '@/api/galaxies'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { formatObjectType } from '@/utils/community-display'
import { renderDangerAction, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const loading = ref(false)
const saving = ref(false)
const contentFormRef = ref<FormInst | null>(null)
const galaxyFormRef = ref<FormInst | null>(null)
const galaxies = ref<Galaxy[]>([])
const selectedSlug = ref<string | null>(null)
const content = ref<GalaxyContent[]>([])
const showAdd = ref(false)
const showGalaxyModal = ref(false)
const editingGalaxy = ref<Galaxy | null>(null)
const galaxySaving = ref(false)
const galaxyForm = ref({ name: '', slug: '', seedKey: '', official: false })
const form = ref({ objectType: 'ARTICLE', objectId: '', pinned: false })
const contentRules: FormRules = { objectId: [{ required: true, message: '请输入对象 ID', trigger: ['input', 'blur'] }] }
const galaxyRules: FormRules = {
  name: [{ required: true, message: '请输入星系名称', trigger: ['input', 'blur'] }],
  slug: [{ required: true, message: '请输入星系别名', trigger: ['input', 'blur'] }]
}

const objectTypeOptions = [
  { label: '文章', value: 'ARTICLE' },
  { label: '系列', value: 'SERIES' }
]

const { showDetail, detailTitle, detailFields, openRemoteContent } = useContentDetailDrawer()

const galaxyOptions = computed(() =>
  galaxies.value.map((galaxy) => ({
    label: galaxy.official ? `${galaxy.name}（官方）` : galaxy.name,
    value: galaxy.slug
  }))
)
const selectedGalaxy = computed(() => galaxies.value.find((galaxy) => galaxy.slug === selectedSlug.value) ?? null)

const columns: DataTableColumns<GalaxyContent> = [
  {
    title: '类型',
    key: 'objectType',
    ...colLayout('type'),
    render: (row) => formatObjectType(row.objectType)
  },
  {
    title: '对象 ID',
    key: 'objectId',
    ...colLayout('objectId'),
    render: (row) => renderTableLink(row.objectId, () => openRemoteContent(row.objectType, row.objectId, row.title))
  },
  {
    title: '标题',
    key: 'title',
    ...colLayout('title'),
    render: (row) => {
      const label = row.title || '(未命名)'
      return renderTableLink(label, () => openRemoteContent(row.objectType, row.objectId, row.title))
    }
  },
  { title: '置顶', key: 'pinned', ...colLayout('boolean'), render: (row) => (row.pinned ? '是' : '否') },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action1'),
    render: (row) => renderTableActionCell([renderDangerAction(() => remove(row.id))])
  }
]

async function loadGalaxies() {
  try {
    galaxies.value = await galaxyApi.list()
    if (!selectedSlug.value && galaxies.value.length) {
      selectedSlug.value = galaxies.value[0].slug
      await loadContent()
    }
  } catch {
    message.error('星系列表暂时无法加载，请检查服务连接后重试')
  }
}

async function loadContent() {
  if (!selectedSlug.value) return
  loading.value = true
  try {
    content.value = await galaxyApi.listContent(selectedSlug.value)
  } catch {
    message.error('星系内容暂时无法加载')
  } finally {
    loading.value = false
  }
}

async function addContent() {
  if (!selectedGalaxy.value) return
  try { await contentFormRef.value?.validate() } catch { return }
  saving.value = true
  try {
    await galaxyApi.addContent(selectedGalaxy.value.id, form.value)
    message.success('已关联')
    showAdd.value = false
    form.value = { objectType: 'ARTICLE', objectId: '', pinned: false }
    await loadContent()
  } catch {
    message.error('关联失败，请确认内容已发布且存在于搜索索引')
  } finally {
    saving.value = false
  }
}

async function remove(contentId: string) {
  try {
    await galaxyApi.removeContent(contentId)
    message.success('已移除')
    await loadContent()
  } catch {
    message.error('移除失败，请稍后重试')
  }
}

function openCreate() {
  editingGalaxy.value = null
  galaxyForm.value = { name: '', slug: '', seedKey: '', official: false }
  showGalaxyModal.value = true
}

function openEdit() {
  if (!selectedGalaxy.value) return
  editingGalaxy.value = selectedGalaxy.value
  galaxyForm.value = {
    name: selectedGalaxy.value.name,
    slug: selectedGalaxy.value.slug,
    seedKey: '',
    official: selectedGalaxy.value.official
  }
  showGalaxyModal.value = true
}

async function saveGalaxy() {
  try { await galaxyFormRef.value?.validate() } catch { return }
  galaxySaving.value = true
  try {
    if (editingGalaxy.value) {
      await galaxyApi.update(editingGalaxy.value.id, {
        name: galaxyForm.value.name,
        official: galaxyForm.value.official
      })
      message.success('星系已更新')
    } else {
      await galaxyApi.create({
        name: galaxyForm.value.name,
        slug: galaxyForm.value.slug,
        seedKey: galaxyForm.value.seedKey || undefined,
        official: galaxyForm.value.official
      })
      message.success('星系已创建')
    }
    showGalaxyModal.value = false
    await loadGalaxies()
  } catch {
    message.error('保存失败')
  } finally {
    galaxySaving.value = false
  }
}

onMounted(loadGalaxies)
</script>

<style scoped lang="scss">
.galaxies-page { display: flex; flex-direction: column; gap: 16px; }
.galaxies-heading { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 2px; }
.galaxies-heading p { margin: 0 0 4px; color: var(--admin-warm); font-size: 12px; font-weight: 700; letter-spacing: .08em; }
.galaxies-heading h1 { margin: 0; color: var(--admin-ink); font-size: 26px; line-height: 1.2; }
.galaxies-heading span { display: block; margin-top: 6px; color: var(--admin-ink-soft); font-size: 13px; }
.galaxies-heading__actions { display: flex; align-items: center; gap: 12px; }
.galaxies-heading__actions > span { margin: 0; white-space: nowrap; }
.galaxies-list-card { min-height: 440px; }
@media (max-width: 760px) {
  .galaxies-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
  .toolbar-row { align-items: flex-start !important; }
}
</style>
