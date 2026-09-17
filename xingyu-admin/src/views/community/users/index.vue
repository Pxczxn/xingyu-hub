<template>
  <main class="community-users-page">
    <section class="users-workspace" aria-label="社区用户管理">
      <header class="users-heading">
        <div>
          <p class="users-kicker">社区运营 / 用户管理</p>
          <h1>社区用户</h1>
        </div>
        <n-button secondary size="small" :loading="loading" @click="load">刷新数据</n-button>
      </header>

      <n-card :bordered="false" class="users-panel page-list-card">
        <div class="users-filters" role="search">
          <n-input v-model:value="searchForm.keyword" clearable placeholder="搜索用户名 / 用户 ID / 简介" @keyup.enter="searchNow" @clear="searchNow" />
          <n-select v-model:value="role" :options="roleOptions" clearable placeholder="身份：全部" />
          <n-select v-model:value="status" :options="statusOptions" clearable placeholder="状态：全部" />
          <n-button tertiary @click="resetFilters">重置</n-button>
        </div>

        <section class="user-metrics" aria-label="用户数据概览">
          <article v-for="item in summary" :key="item.label" class="metric-card" :class="'metric-card--' + item.tone">
            <span class="metric-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <span class="metric-note">{{ item.note }}</span>
            <i class="metric-orbit" aria-hidden="true"></i>
          </article>
        </section>

        <div class="page-list-body">
          <div class="list-caption">
            <span>共 <strong>{{ items.length }}</strong> 位用户</span>
          </div>

          <div class="page-list-table-region">
            <n-data-table
              v-bind="communityUsersTableProps"
              class="community-users-table"
              :columns="displayColumns"
              :data="tableData"
              :loading="loading"
              :pagination="items.length ? pagination : false"
              :row-key="(row: CommunityUserItem) => row.id"
              :row-props="rowProps"
              @update:sorter="handleSorterChange"
              @update:page="handlePageChange"
            />
          </div>
        </div>
      </n-card>
    </section>

    <AuthorDetailDrawer v-model:show="showAuthor" :author="selectedAuthor" />
  </main>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NAvatar, NButton, NDropdown, NIcon, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import { CopyOutline, ChevronDownOutline } from '@vicons/ionicons5'
import { communityUsersApi, type CommunityUserItem } from '@/api/community-users'
import AuthorDetailDrawer from '@/components/community/AuthorDetailDrawer.vue'
import { useAuthorDetailDrawer } from '@/composables/useCommunityDrawers'
import { useTableSort } from '@/composables/useTableSort'
import { COMMUNITY_USER_STATUS_META, COMMUNITY_USER_ROLE_FILTER_OPTIONS, formatAuthorLabel, formatCommunityUserRole, matchesCommunityUserRole } from '@/utils/community-display'
import { renderDateTime, renderEllipsisText, renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, defaultListPagination, tableListFlexProps, tableScrollFromColumns } from '@/utils/table-layout'

const message = useMessage()
const dialog = useDialog()
const route = useRoute()
const loading = ref(false)
const items = ref<CommunityUserItem[]>([])
const searchForm = reactive({ keyword: '' })
const status = ref<string | null>(null)
const role = ref<string | null>(null)
const { showAuthor, selectedAuthor, openAuthor } = useAuthorDetailDrawer()
const activeUserId = computed(() => (showAuthor.value ? (selectedAuthor.value as { authorId?: string } | null)?.authorId : undefined))

const statusOptions = [
  { label: '待审核', value: 'PENDING_REVIEW' },
  { label: '正常', value: 'ACTIVE' },
  { label: '审核拒绝', value: 'REJECTED' },
  { label: '已停用', value: 'SUSPENDED' }
]
const roleOptions = [...COMMUNITY_USER_ROLE_FILTER_OPTIONS]
const summary = computed(() => [
  { label: '用户总数', value: items.value.length, note: '当前筛选结果', tone: 'amber' },
  { label: '待审核', value: items.value.filter(item => item.status === 'PENDING_REVIEW').length, note: '需要处理', tone: 'blue' },
  { label: '正常账号', value: items.value.filter(item => item.status === 'ACTIVE').length, note: '可正常访问', tone: 'green' },
  { label: '需要关注', value: items.value.filter(item => ['REJECTED', 'SUSPENDED'].includes(item.status)).length, note: '已拒绝或停用', tone: 'violet' }
])
const pagination = reactive({ ...defaultListPagination, page: 1 })

function userLabel(row: CommunityUserItem) { return formatAuthorLabel(row.displayName, row.username, row.username || row.email || '未设置用户名') }
function avatarLabel(row: CommunityUserItem) { return (row.displayName || row.username || row.email || '?').slice(0, 1).toUpperCase() }
function openUser(row: CommunityUserItem) {
  openAuthor({
    authorId: row.id,
    authorDisplayName: row.displayName,
    authorUsername: row.username,
    authorEmail: row.email,
    status: row.status,
    role: row.role,
    phone: row.phone,
    emailVerified: row.emailVerified,
    phoneVerified: row.phoneVerified,
    createdAt: row.createdAt
  })
}
function resetFilters() {
  searchForm.keyword = ''
  status.value = null
  role.value = null
}
function rowProps(row: CommunityUserItem) {
  return {
    class: activeUserId.value === row.id ? 'community-users-table__row--active' : ''
  }
}

function renderUserId(row: CommunityUserItem) {
  const id = row.id
  const short = id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
  return h('span', { class: 'user-id', title: `用户 ID：${id}` }, [
    'ID: ' + short,
    h(
      NButton,
      {
        size: 'tiny',
        quaternary: true,
        class: 'user-id-copy',
        title: '复制用户 ID',
        onClick: (e: MouseEvent) => {
          e.stopPropagation()
          copyId(id)
        }
      },
      { icon: () => h(NIcon, { size: 13 }, { default: () => h(CopyOutline) }) })
  ])
}

function copyId(id: string) {
  if (!navigator.clipboard?.writeText) {
    message.warning('当前环境不支持自动复制，请手动选择复制')
    return
  }
  navigator.clipboard.writeText(id).then(
    () => message.success('用户 ID 已复制'),
    () => message.error('复制失败，请手动选择复制')
  )
}

function renderMoreMenu(row: CommunityUserItem, options: Array<{ label: string; key: string }>) {
  if (!options.length) return null
  return h(
    NDropdown,
    {
      trigger: 'click',
      options,
      onSelect: (key: string) => handleMore(key, row)
    },
    {
      default: () =>
        renderTableActionButton('更多', undefined, { icon: ChevronDownOutline })
    }
  )
}

function handleMore(key: string, row: CommunityUserItem) {
  if (key === 'reject') void reject(row.id)
  else if (key === 'detail') openUser(row)
}

const renderUserActions = (row: CommunityUserItem) => {
  const moreOptions: Array<{ label: string; key: string }> = []
  if (row.status === 'PENDING_REVIEW') {
    moreOptions.push({ label: '拒绝', key: 'reject' })
    return renderTableActionCell([
      renderTableActionButton('通过', () => approve(row.id), { type: 'primary' }),
      renderMoreMenu(row, moreOptions)
    ])
  }
  moreOptions.push({ label: '查看详情', key: 'detail' })
  return renderTableActionCell([
    renderTableActionButton('重置密码', () => confirmResetPassword(row)),
    renderMoreMenu(row, moreOptions)
  ])
}

function compareAuthor(a: CommunityUserItem, b: CommunityUserItem) {
  return userLabel(a).localeCompare(userLabel(b), 'zh-CN', { sensitivity: 'base' })
}

function compareRole(a: CommunityUserItem, b: CommunityUserItem) {
  return formatCommunityUserRole(a.role).localeCompare(formatCommunityUserRole(b.role), 'zh-CN', { sensitivity: 'base' })
}

function compareCreatedAt(a: CommunityUserItem, b: CommunityUserItem) {
  const left = a.createdAt ? Date.parse(a.createdAt) : 0
  const right = b.createdAt ? Date.parse(b.createdAt) : 0
  return (Number.isNaN(left) ? 0 : left) - (Number.isNaN(right) ? 0 : right)
}

const STATUS_SORT_ORDER: Record<string, number> = {
  PENDING_REVIEW: 0,
  ACTIVE: 1,
  REJECTED: 2,
  SUSPENDED: 3,
  DELETED: 4
}

function compareStatus(a: CommunityUserItem, b: CommunityUserItem) {
  return (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99)
}

function handlePageChange(page: number) {
  pagination.page = page
}

const userColumns: DataTableColumns<CommunityUserItem> = [
  {
    title: '用户',
    key: 'username',
    ...colLayout('author'),
    sorter: compareAuthor,
    render: row => h('div', { class: 'user-cell' }, [
      h(NAvatar, { round: true, size: 34, class: 'user-avatar' }, { default: () => avatarLabel(row) }),
      h('div', { class: 'user-copy' }, [
        renderTableLink(userLabel(row), () => openUser(row)),
        renderUserId(row)
      ])
    ])
  },
  { title: '身份', key: 'role', ...colLayout('role'), sorter: compareRole, render: row => cellText(formatCommunityUserRole(row.role)) },
  { title: '加入时间', key: 'createdAt', ...colLayout('datetime'), sorter: compareCreatedAt, render: row => renderDateTime(row.createdAt) },
  { title: '账号状态', key: 'status', ...colLayout('accountStatus'), sorter: compareStatus, render: row => renderStatusTag(row.status, COMMUNITY_USER_STATUS_META) },
  {
    title: '邮箱',
    key: 'email',
    ...colLayout('email'),
    render: row => h('div', { class: 'email-cell' }, [
      renderEllipsisText(row.email),
      row.emailVerified
        ? h(NTag, { size: 'small', type: 'success', bordered: false, class: 'verify-badge' }, { default: () => '已验证' })
        : h(NTag, { size: 'small', type: 'default', bordered: false, class: 'verify-badge' }, { default: () => '未验证' })
    ])
  },
  { title: '操作', key: 'actions', ...colLayout('action2'), render: renderUserActions }
]

const communityUsersTableProps = tableListFlexProps(tableScrollFromColumns(userColumns))

const { columns: displayColumns, handleSorterChange } = useTableSort<CommunityUserItem>({
  columns: userColumns,
  defaultKey: 'createdAt',
  defaultOrder: 'descend'
})

const tableData = computed(() => items.value)

async function load() {
  loading.value = true
  const keyword = searchForm.keyword.trim()
  try {
    items.value = await communityUsersApi.list({
      status: status.value || undefined,
      keyword: keyword || undefined,
      limit: 100
    })
    const roleFilter = role.value
    if (roleFilter) items.value = items.value.filter(item => matchesCommunityUserRole(item.role, roleFilter))
  } catch { message.error('社区用户暂时无法加载，请检查服务连接后重试') } finally { loading.value = false }
}

let searchTimer: ReturnType<typeof setTimeout> | undefined
/**
 * 回车只负责"立即执行待发的那一次请求"：pending 定时器存在则马上执行并清空，
 * 不存在说明 watch 的防抖已经加载过，直接忽略，避免回车多发一次请求。
 */
function searchNow() {
  if (!searchTimer) return
  clearTimeout(searchTimer)
  searchTimer = undefined
  void load()
}

watch(
  () => [searchForm.keyword, status.value, role.value] as const,
  ([keyword], [previousKeyword]) => {
    if (searchTimer) clearTimeout(searchTimer)
    pagination.page = 1
    const delay = keyword === previousKeyword ? 0 : 150
    searchTimer = setTimeout(() => { searchTimer = undefined; void load() }, delay)
  }
)
async function approve(userId: string) { try { await communityUsersApi.approve(userId); message.success('已通过该用户的社区审核'); await load() } catch { message.error('审核操作未完成，请稍后重试') } }
async function reject(userId: string) { try { await communityUsersApi.reject(userId); message.success('已拒绝该用户的注册申请'); await load() } catch { message.error('审核操作未完成，请稍后重试') } }
function confirmResetPassword(row: CommunityUserItem) {
  if (!row.email?.trim()) {
    message.warning('该用户未绑定邮箱，无法发送临时密码')
    return
  }
  const dialogInst = dialog.warning({
    title: '重置密码',
    content: `确定向用户「${userLabel(row)}」的邮箱 ${row.email} 发送临时密码吗？临时密码 5 分钟内有效，用户登录后需立即修改密码。`,
    positiveText: '发送',
    negativeText: '取消',
    maskClosable: false,
    onPositiveClick: async () => {
      dialogInst.loading = true
      dialogInst.positiveText = '正在发送'
      dialogInst.negativeButtonProps = { disabled: true }
      dialogInst.closable = false
      try {
        const result = await communityUsersApi.resetPassword(row.id)
        const email = result.recipientEmail || row.email
        const tempPassword = result.tempPassword
        const passwordHint = tempPassword
          ? `临时密码：${tempPassword}（5 分钟内有效）`
          : '请重新发起重置以获取临时密码。'
        if (result.mailPending === true) {
          const reason = result.mailError ? `原因：${result.mailError}。` : ''
          message.warning(`密码已重置，但邮件未成功投递。${reason}${passwordHint}`, { duration: 12000 })
        } else {
          message.success(
            `已向 ${email} 提交发送临时密码，请提醒用户查收收件箱与垃圾邮件。${passwordHint}`,
            { duration: 12000 }
          )
        }
        return true
      } catch {
        dialogInst.loading = false
        dialogInst.positiveText = '发送'
        dialogInst.negativeButtonProps = { disabled: false }
        dialogInst.closable = true
        return false
      }
    }
  })
}
onMounted(async () => {
  await load()
  const userId = route.params.userId as string | undefined
  if (!userId) return
  const row = items.value.find(item => item.id === userId)
  if (row) openUser(row)
})
</script>

<style scoped lang="scss">
.community-users-page { display: flex; height: 100%; min-height: 0; flex-direction: column; padding: 18px; overflow: hidden; background: #f7f7f5; }
.users-workspace { display: flex; flex: 1; min-width: 0; min-height: 0; flex-direction: column; gap: 14px; }
.users-heading { display: flex; align-items: end; justify-content: space-between; padding: 2px 2px 0; }
.users-kicker { margin: 0 0 3px; color: #8a7259; font-size: 12px; letter-spacing: .06em; }
.users-heading h1 { margin: 0; color: #192744; font-size: 25px; line-height: 1.15; }
.users-panel { display: flex; min-height: 0; flex: 1; flex-direction: column; background: rgb(255 255 255 / .94); }
.users-panel :deep(.n-card__content) { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 16px; padding-top: 14px; overflow: hidden; }
.users-filters { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(2, minmax(125px, .72fr)) auto auto; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid #edf0f4; flex-shrink: 0; }
.user-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; flex-shrink: 0; }
.metric-card { position: relative; display: flex; min-height: 100px; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; padding: 17px 18px; border: 1px solid #f0ebe4; border-radius: 12px; background: linear-gradient(135deg, #fff, #fdfaf5); }
.metric-label, .metric-note { position: relative; z-index: 1; color: #7d8797; font-size: 12px; }
.metric-card strong { position: relative; z-index: 1; color: #17243e; font-size: 24px; letter-spacing: -.03em; line-height: 1.15; }
.metric-note { color: #9b8068; }
.metric-orbit { position: absolute; right: -10px; bottom: -22px; width: 74px; height: 74px; border: 12px solid currentColor; border-radius: 50%; opacity: .12; }
.metric-card--amber { color: #f09a28; } .metric-card--blue { color: #4a8eff; } .metric-card--green { color: #35b973; } .metric-card--violet { color: #736af0; }
.list-caption { display: flex; align-items: center; color: #798397; font-size: 13px; flex-shrink: 0; }
.list-caption strong { color: #233352; font-size: 15px; }
:deep(.community-users-table .community-users-table__row--active .n-data-table-td) { background: #fff9ef !important; }
:deep(.user-cell) { display: flex; align-items: center; gap: 10px; min-width: 0; }
:deep(.user-copy) { display: grid; min-width: 0; gap: 1px; }
:deep(.user-copy .community-table-link) { margin: -3px -6px; width: calc(100% + 12px); }
:deep(.user-id) { display: inline-flex; align-items: center; gap: 4px; color: #98a1b0; font-size: 11px; line-height: 1.35; }
:deep(.user-id-copy) { opacity: .5; }
:deep(.user-id-copy:hover) { opacity: 1; }
:deep(.email-cell) { display: flex; align-items: center; gap: 6px; min-width: 0; }
:deep(.email-cell .n-ellipsis) { min-width: 0; }
:deep(.verify-badge) { margin-left: 2px; flex-shrink: 0; }
:deep(.user-avatar) { color: #fff; background: linear-gradient(145deg, #566d9f, #283d66); }
@media (max-width: 1180px) { .users-filters { grid-template-columns: minmax(190px, 1fr) repeat(2, minmax(120px, .7fr)) auto auto; } }
@media (max-width: 800px) { .community-users-page { height: auto; min-height: 100%; padding: 12px; }.users-filters, .user-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.users-filters .n-button { justify-self: start; } .page-list-table-region { min-height: 360px; } }
@media (max-width: 520px) { .users-filters, .user-metrics { grid-template-columns: 1fr; }.users-heading h1 { font-size: 22px; } }
</style>
