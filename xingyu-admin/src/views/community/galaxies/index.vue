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
          <n-tag v-if="selectedGalaxy?.joinMode === 'APPROVAL'" type="warning" :bordered="false">
            需申请加入
          </n-tag>
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
          <n-button :disabled="!selectedGalaxy" @click="openReview">
            待审推荐
            <n-tag
              v-if="pendingSubmissions.length"
              size="small"
              type="warning"
              :bordered="false"
              style="margin-left: 6px"
            >
              {{ pendingSubmissions.length }}
            </n-tag>
          </n-button>
        </n-space>

        <n-data-table
          v-if="content.length || loading"
          v-bind="tableListProps(tableScroll)"
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
        <n-form-item label="加入方式">
          <n-select v-model:value="galaxyForm.joinMode" :options="joinModeOptions" />
        </n-form-item>
        <n-form-item label="简介" path="description">
          <n-input
            v-model:value="galaxyForm.description"
            type="textarea"
            :rows="3"
            maxlength="512"
            show-count
            placeholder="展示在社区端星系 Hero；留空则不显示简介"
          />
        </n-form-item>
        <n-form-item label="封面 URL" path="coverUrl">
          <n-input v-model:value="galaxyForm.coverUrl" placeholder="留空使用系统装饰图" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showGalaxyModal = false">取消</n-button>
          <n-button type="primary" :loading="galaxySaving" @click="saveGalaxy">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 待审列表列宽合计约 1134px：弹窗窄于它时「推荐语/提交时间」会被挤出可视区，审核者得先横向滚动才能读到成员的推荐理由，所以这里按列宽给足并限制在视口内。 -->
    <n-modal v-model:show="showReview" preset="card" title="待审推荐" style="width: min(1160px, 94vw)">
      <n-data-table
        v-if="pendingSubmissions.length"
        v-bind="tableListProps(submissionScroll)"
        :columns="submissionColumns"
        :data="pendingSubmissions"
        :loading="reviewLoading"
        :row-key="(row: GalaxyContentSubmission) => row.id"
      />
      <EmptyState
        v-else
        title="没有待审推荐"
        description="成员推荐的作品会出现在这里；通过后自动进入该星系的关联内容。"
      />
    </n-modal>

    <n-modal v-model:show="showReject" preset="card" title="拒绝推荐" style="width: 440px">
      <n-form label-placement="left" label-width="60">
        <n-form-item label="理由">
          <n-input
            v-model:value="rejectReason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-count
            placeholder="告诉作者为什么这次推荐不合适（必填）"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showReject = false">取消</n-button>
          <n-button type="error" :loading="rejecting" @click="confirmReject">确认拒绝</n-button>
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
import { galaxyApi, type Galaxy, type GalaxyContent, type GalaxyContentSubmission } from '@/api/galaxies'
import RecordDetailDrawer from '@/components/community/RecordDetailDrawer.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useContentDetailDrawer } from '@/composables/useCommunityDrawers'
import { formatObjectType } from '@/utils/community-display'
import {
  renderDangerAction,
  renderDateTime,
  renderTableActionButton,
  renderTableActionCell,
  renderTableLink
} from '@/utils/table-cells'
import { colLayout, tableListProps, tableScrollFromColumns } from '@/utils/table-layout'

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
const galaxyForm = ref({
  name: '',
  slug: '',
  seedKey: '',
  official: false,
  joinMode: 'OPEN',
  description: '',
  coverUrl: ''
})
const form = ref({ objectType: 'ARTICLE', objectId: '', pinned: false })
/* 内容推荐审核（V054）：待审列表只来自服务端 PENDING，处理完重新拉一次。 */
const showReview = ref(false)
const reviewLoading = ref(false)
const pendingSubmissions = ref<GalaxyContentSubmission[]>([])
const showReject = ref(false)
const rejecting = ref(false)
const rejectReason = ref('')
const rejectTarget = ref<GalaxyContentSubmission | null>(null)
const contentRules: FormRules = { objectId: [{ required: true, message: '请输入对象 ID', trigger: ['input', 'blur'] }] }
const galaxyRules: FormRules = {
  name: [{ required: true, message: '请输入星系名称', trigger: ['input', 'blur'] }],
  slug: [{ required: true, message: '请输入星系别名', trigger: ['input', 'blur'] }],
  description: [{ max: 512, message: '简介不能超过 512 字', trigger: ['input', 'blur'] }],
  coverUrl: [{ max: 512, message: '封面地址不能超过 512 字', trigger: ['input', 'blur'] }]
}

const objectTypeOptions = [
  { label: '文章', value: 'ARTICLE' },
  { label: '系列', value: 'SERIES' },
  { label: '动态', value: 'MOMENT' }
]
const joinModeOptions = [
  { label: '直接加入（OPEN）', value: 'OPEN' },
  { label: '申请审核（APPROVAL）', value: 'APPROVAL' }
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
const tableScroll = tableScrollFromColumns(columns)

/*
 * 待审推荐表。作品标题来自活文档：为 null 说明作品已下架/删除，
 * 这里显示「内容不可用」而不是旧标题，也仍然允许管理员拒绝它。
 */
const submissionColumns: DataTableColumns<GalaxyContentSubmission> = [
  {
    title: '作品',
    key: 'title',
    ...colLayout('title'),
    render: (row) => {
      const title = row.title
      if (!title) return '(内容不可用)'
      return renderTableLink(title, () => openRemoteContent(row.objectType, row.objectId, title))
    }
  },
  {
    title: '类型',
    key: 'objectType',
    ...colLayout('type'),
    render: (row) => formatObjectType(row.objectType)
  },
  { title: '推荐人', key: 'submitterName', ...colLayout('author') },
  {
    title: '推荐语',
    key: 'note',
    ...colLayout('summary'),
    render: (row) => row.note || '—'
  },
  {
    title: '提交时间',
    key: 'createdAt',
    ...colLayout('datetime'),
    render: (row) => renderDateTime(row.createdAt)
  },
  {
    title: '操作',
    key: 'actions',
    ...colLayout('action2'),
    render: (row) =>
      renderTableActionCell([
        renderTableActionButton('通过', () => approveSubmission(row), { type: 'primary' }),
        renderTableActionButton('拒绝', () => askReject(row), { type: 'error' })
      ])
  }
]
const submissionScroll = tableScrollFromColumns(submissionColumns)


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
    // 待审数量决定工具栏徽标，与内容列表一起刷新；失败只影响徽标，不打断内容。
    void loadSubmissions()
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

/* ---- 内容推荐审核（V054）---- */

async function loadSubmissions() {
  if (!selectedGalaxy.value) return
  reviewLoading.value = true
  try {
    pendingSubmissions.value = await galaxyApi.listContentSubmissions(selectedGalaxy.value.id)
  } catch {
    // 待审推荐读失败不影响主列表；徽标保持上一次的值。
  } finally {
    reviewLoading.value = false
  }
}

async function openReview() {
  if (!selectedGalaxy.value) return
  showReview.value = true
  await loadSubmissions()
}

async function approveSubmission(row: GalaxyContentSubmission) {
  try {
    await galaxyApi.approveContentSubmission(row.id)
    message.success(`「${row.title ?? '该作品'}」已进入星系内容`)
    await Promise.all([loadSubmissions(), loadContent()])
  } catch (err) {
    /*
     * 通过失败最常见的原因是作品在提交后被下架/治理隐藏（服务端 409），
     * 此时绝不能把这行从待审里删掉 —— 让管理员看到失败原因，由他决定拒绝还是等作品恢复。
     */
    message.error(readErrorMessage(err, '通过失败：作品可能已下架或不在待审状态'))
  }
}

function askReject(row: GalaxyContentSubmission) {
  rejectTarget.value = row
  rejectReason.value = ''
  showReject.value = true
}

async function confirmReject() {
  if (!rejectTarget.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    message.warning('请填写拒绝理由')
    return
  }
  rejecting.value = true
  try {
    await galaxyApi.rejectContentSubmission(rejectTarget.value.id, reason)
    message.success('已拒绝并记录理由')
    showReject.value = false
    await loadSubmissions()
  } catch (err) {
    message.error(readErrorMessage(err, '拒绝失败，请稍后重试'))
  } finally {
    rejecting.value = false
  }
}

/** 后端已拒绝时把它的原话带给管理员，避免一律显示"操作失败"。 */
function readErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function openCreate() {
  editingGalaxy.value = null
  galaxyForm.value = {
    name: '',
    slug: '',
    seedKey: '',
    official: false,
    joinMode: 'OPEN',
    description: '',
    coverUrl: ''
  }
  showGalaxyModal.value = true
}

function openEdit() {
  if (!selectedGalaxy.value) return
  editingGalaxy.value = selectedGalaxy.value
  galaxyForm.value = {
    name: selectedGalaxy.value.name,
    slug: selectedGalaxy.value.slug,
    seedKey: '',
    official: selectedGalaxy.value.official,
    joinMode: selectedGalaxy.value.joinMode ?? 'OPEN',
    // 后端 null = 未填写；空串提交会被服务端 trim 归 null（清空语义）
    description: selectedGalaxy.value.description ?? '',
    coverUrl: selectedGalaxy.value.coverUrl ?? ''
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
        official: galaxyForm.value.official,
        joinMode: galaxyForm.value.joinMode,
        description: galaxyForm.value.description.trim() || null,
        coverUrl: galaxyForm.value.coverUrl.trim() || null
      })
      message.success('星系已更新')
    } else {
      await galaxyApi.create({
        name: galaxyForm.value.name,
        slug: galaxyForm.value.slug,
        seedKey: galaxyForm.value.seedKey || undefined,
        official: galaxyForm.value.official,
        joinMode: galaxyForm.value.joinMode,
        description: galaxyForm.value.description.trim() || null,
        coverUrl: galaxyForm.value.coverUrl.trim() || null
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
