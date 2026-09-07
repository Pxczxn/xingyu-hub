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

      <n-card :bordered="false" class="users-panel">
        <div class="users-filters" role="search">
          <n-input v-model:value="searchForm.username" clearable placeholder="搜索用户名 / 用户 ID / 简介" @keyup.enter="load" />
          <n-select v-model:value="role" :options="roleOptions" clearable placeholder="身份：全部" />
          <n-select v-model:value="status" :options="statusOptions" clearable placeholder="状态：全部" />
          <n-button tertiary @click="resetFilters">重置</n-button>
          <n-button type="primary" @click="load">筛选用户</n-button>
        </div>

        <section class="user-metrics" aria-label="用户数据概览">
          <article v-for="item in summary" :key="item.label" class="metric-card" :class="'metric-card--' + item.tone">
            <span class="metric-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <span class="metric-note">{{ item.note }}</span>
            <i class="metric-orbit" aria-hidden="true"></i>
          </article>
        </section>

        <div class="list-caption">
          <span>共 <strong>{{ items.length }}</strong> 位用户</span>
          <span class="list-caption-hint">选择一位用户即可在右侧查看资料</span>
        </div>

        <n-data-table
          v-bind="tableListProps(tableScrollX(isFuzzySearching ? 3 : 8, 1040))"
          class="community-users-table"
          :flex-height="true"
          :columns="displayColumns"
          :data="items"
          :loading="loading"
          :pagination="pagination"
          :row-key="(row: CommunityUserItem) => row.id"
          :row-props="rowProps"
        />
      </n-card>
    </section>

    <aside class="user-insight" aria-label="用户洞察">
      <header class="insight-heading">
        <h2>用户洞察</h2>
        <button class="insight-close" type="button" aria-label="关闭用户洞察" @click="selectedUser = null">×</button>
      </header>

      <template v-if="selectedUser">
        <section class="insight-profile">
          <div class="insight-avatar" aria-hidden="true">{{ avatarLabel(selectedUser) }}</div>
          <div>
            <h3>{{ userLabel(selectedUser) }}</h3>
            <p>ID: {{ selectedUser.id }}</p>
          </div>
        </section>
        <p class="insight-meta">加入时间 {{ selectedUser.createdAt || '暂未记录' }}</p>
        <div class="insight-state-row">
          <span class="online-state" :class="{ 'online-state--active': selectedUser.status === 'ACTIVE' }">{{ statusLabel(selectedUser.status) }}</span>
          <span>{{ selectedUser.role || 'MEMBER' }}</span>
        </div>

        <n-tabs type="line" animated class="insight-tabs">
          <n-tab-pane name="profile" tab="资料与验证">
            <dl class="profile-fields">
              <div><dt>邮箱</dt><dd>{{ selectedUser.email || '未填写' }}</dd></div>
              <div><dt>邮箱验证</dt><dd>{{ selectedUser.emailVerified ? '已验证' : '未验证' }}</dd></div>
              <div><dt>手机号</dt><dd>{{ selectedUser.phone || '未填写' }}</dd></div>
              <div><dt>手机验证</dt><dd>{{ selectedUser.phoneVerified ? '已验证' : '未验证' }}</dd></div>
            </dl>
          </n-tab-pane>
          <n-tab-pane name="account" tab="账号状态">
            <div class="account-state-card">
              <span>当前账号状态</span>
              <strong>{{ statusLabel(selectedUser.status) }}</strong>
              <p>审核与账号状态由社区审核流程维护。</p>
            </div>
          </n-tab-pane>
        </n-tabs>
      </template>

      <section v-else class="insight-empty">
        <div class="empty-orbit" aria-hidden="true"><i></i><b></b></div>
        <h3>选择一位社区用户</h3>
        <p>用户的身份、验证情况与账号状态会显示在这里。</p>
      </section>
    </aside>

    <AuthorDetailDrawer v-model:show="showAuthor" :author="selectedAuthor" />
  </main>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { NAvatar, useMessage, type DataTableColumns } from 'naive-ui'
import { communityUsersApi, type CommunityUserItem } from '@/api/community-users'
import AuthorDetailDrawer from '@/components/community/AuthorDetailDrawer.vue'
import { useAuthorDetailDrawer } from '@/composables/useCommunityDrawers'
import { COMMUNITY_USER_STATUS_META, formatAuthorLabel, AUTHOR_COLUMN_TITLE } from '@/utils/community-display'
import { renderStatusTag, renderTableActionButton, renderTableActionCell, renderTableLink } from '@/utils/table-cells'
import { cellText, colLayout, tableListProps, tableScrollX } from '@/utils/table-layout'

const message = useMessage()
const route = useRoute()
const loading = ref(false)
const items = ref<CommunityUserItem[]>([])
const selectedUser = ref<CommunityUserItem | null>(null)
const searchForm = reactive({ username: '' })
const status = ref<string | null>(null)
const role = ref<string | null>(null)
const { showAuthor, selectedAuthor, openAuthor } = useAuthorDetailDrawer()

const statusOptions = [
  { label: '待审核', value: 'PENDING_REVIEW' },
  { label: '正常', value: 'ACTIVE' },
  { label: '审核拒绝', value: 'REJECTED' },
  { label: '已停用', value: 'SUSPENDED' }
]
const roleOptions = [{ label: '普通成员', value: 'MEMBER' }, { label: '创作者', value: 'CREATOR' }, { label: '管理员', value: 'ADMIN' }]
const isFuzzySearching = computed(() => Boolean(searchForm.username.trim()))
const summary = computed(() => [
  { label: '用户总数', value: items.value.length, note: '当前筛选结果', tone: 'amber' },
  { label: '待审核', value: items.value.filter(item => item.status === 'PENDING_REVIEW').length, note: '需要处理', tone: 'blue' },
  { label: '正常账号', value: items.value.filter(item => item.status === 'ACTIVE').length, note: '可正常访问', tone: 'green' },
  { label: '需要关注', value: items.value.filter(item => ['REJECTED', 'SUSPENDED'].includes(item.status)).length, note: '已拒绝或停用', tone: 'violet' }
])
const pagination = { pageSize: 10, showSizePicker: false }

function userLabel(row: CommunityUserItem) { return formatAuthorLabel(row.displayName, row.username, row.username || row.email || '未设置用户名') }
function avatarLabel(row: CommunityUserItem) { return (row.displayName || row.username || row.email || '?').slice(0, 1).toUpperCase() }
function statusLabel(value: string) { return COMMUNITY_USER_STATUS_META[value]?.label || value || '未知状态' }
function openUser(row: CommunityUserItem) {
  selectedUser.value = row
  openAuthor({ authorId: row.id, authorDisplayName: row.displayName, authorUsername: row.username, authorEmail: row.email })
}
function resetFilters() { searchForm.username = ''; status.value = null; role.value = null; load() }
function rowProps(row: CommunityUserItem) {
  return { class: selectedUser.value?.id === row.id ? 'community-users-table__row--active' : '', onClick: () => { selectedUser.value = row } }
}

const fuzzySearchColumns: DataTableColumns<CommunityUserItem> = [
  { title: AUTHOR_COLUMN_TITLE, key: 'username', ...colLayout('author'), render: row => renderTableLink(userLabel(row), () => openUser(row)) },
  { title: '邮箱', key: 'email', ...colLayout('email'), render: row => cellText(row.email) },
  { title: '手机号', key: 'phone', ...colLayout('phone'), render: row => cellText(row.phone) }
]
const fullColumns: DataTableColumns<CommunityUserItem> = [
  {
    title: AUTHOR_COLUMN_TITLE, key: 'username', ...colLayout('author'), render: row => h('div', { class: 'user-cell' }, [
      h(NAvatar, { round: true, size: 34, class: 'user-avatar' }, { default: () => avatarLabel(row) }),
      h('div', { class: 'user-copy' }, [renderTableLink(userLabel(row), () => openUser(row)), h('span', { class: 'user-id' }, 'ID: ' + row.id)])
    ])
  },
  { title: '身份', key: 'role', ...colLayout('role'), render: row => cellText(row.role || 'MEMBER') },
  { title: '加入时间', key: 'createdAt', ...colLayout('datetime'), render: row => cellText(row.createdAt) },
  { title: '活跃状态', key: 'status', ...colLayout('status'), render: row => renderStatusTag(row.status, COMMUNITY_USER_STATUS_META) },
  { title: '邮箱验证', key: 'verified', ...colLayout('verify'), render: row => cellText(row.emailVerified ? '已验证' : '未验证') },
  { title: '邮箱', key: 'email', ...colLayout('email'), render: row => cellText(row.email) },
  {
    title: '操作', key: 'actions', ...colLayout('action2'), render: row => row.status === 'PENDING_REVIEW'
      ? renderTableActionCell([renderTableActionButton('通过', () => approve(row.id), { type: 'primary' }), renderTableActionButton('拒绝', () => reject(row.id), { type: 'error' })])
      : renderTableActionCell([renderTableActionButton('查看', () => openUser(row))])
  }
]
const displayColumns = computed(() => isFuzzySearching.value ? fuzzySearchColumns : fullColumns)

async function load() {
  loading.value = true
  try {
    items.value = await communityUsersApi.list({ status: status.value || undefined, username: searchForm.username.trim() || undefined, limit: 100 })
    if (role.value) items.value = items.value.filter(item => item.role === role.value)
    if (selectedUser.value) selectedUser.value = items.value.find(item => item.id === selectedUser.value?.id) || null
  } catch { message.error('社区用户暂时无法加载，请检查服务连接后重试') } finally { loading.value = false }
}
async function approve(userId: string) { try { await communityUsersApi.approve(userId); message.success('已通过该用户的社区审核'); await load() } catch { message.error('审核操作未完成，请稍后重试') } }
async function reject(userId: string) { try { await communityUsersApi.reject(userId); message.success('已拒绝该用户的注册申请'); await load() } catch { message.error('审核操作未完成，请稍后重试') } }
onMounted(async () => {
  await load()
  const userId = route.params.userId as string | undefined
  if (userId) selectedUser.value = items.value.find(item => item.id === userId) || null
})
</script>

<style scoped lang="scss">
.community-users-page { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 16px; height: 100%; min-height: 0; padding: 18px; overflow: hidden; background: #f7f7f5; }
.users-workspace { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: 14px; }
.users-heading { display: flex; align-items: end; justify-content: space-between; padding: 2px 2px 0; }
.users-kicker { margin: 0 0 3px; color: #8a7259; font-size: 12px; letter-spacing: .06em; }
.users-heading h1 { margin: 0; color: #192744; font-size: 25px; line-height: 1.15; }
.users-panel { display: flex; min-height: 0; flex: 1; flex-direction: column; background: rgb(255 255 255 / .94); }
.users-panel :deep(.n-card__content) { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 16px; padding-top: 14px; }
.users-filters { display: grid; grid-template-columns: minmax(220px, 1.5fr) repeat(2, minmax(125px, .72fr)) auto auto; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid #edf0f4; }
.user-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.metric-card { position: relative; display: flex; min-height: 100px; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; padding: 17px 18px; border: 1px solid #f0ebe4; border-radius: 12px; background: linear-gradient(135deg, #fff, #fdfaf5); }
.metric-label, .metric-note { position: relative; z-index: 1; color: #7d8797; font-size: 12px; }
.metric-card strong { position: relative; z-index: 1; color: #17243e; font-size: 24px; letter-spacing: -.03em; line-height: 1.15; }
.metric-note { color: #9b8068; }
.metric-orbit { position: absolute; right: -10px; bottom: -22px; width: 74px; height: 74px; border: 12px solid currentColor; border-radius: 50%; opacity: .12; }
.metric-card--amber { color: #f09a28; } .metric-card--blue { color: #4a8eff; } .metric-card--green { color: #35b973; } .metric-card--violet { color: #736af0; }
.list-caption { display: flex; justify-content: space-between; align-items: center; color: #798397; font-size: 13px; }
.list-caption strong { color: #233352; font-size: 15px; } .list-caption-hint { color: #a2aab8; font-size: 12px; }
.community-users-table { min-height: 300px; flex: 1; }
:deep(.community-users-table .n-data-table-tr) { cursor: pointer; }
:deep(.community-users-table .community-users-table__row--active .n-data-table-td) { background: #fff9ef !important; }
:deep(.user-cell) { display: flex; align-items: center; gap: 10px; min-width: 0; } :deep(.user-copy) { display: grid; min-width: 0; gap: 2px; } :deep(.user-id) { color: #98a1b0; font-size: 11px; } :deep(.user-avatar) { color: #fff; background: linear-gradient(145deg, #566d9f, #283d66); }
.user-insight { display: flex; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid #e8e9ed; border-radius: 14px; background: rgb(255 255 255 / .95); box-shadow: 0 8px 24px rgb(22 38 66 / .05); }
.insight-heading { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 15px; border-bottom: 1px solid #eef0f3; }.insight-heading h2 { margin: 0; color: #1b2842; font-size: 16px; }.insight-close { width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: #69758a; cursor: pointer; font-size: 22px; line-height: 1; }.insight-close:hover { background: #f3f5f8; }
.insight-profile { display: flex; align-items: center; gap: 12px; padding: 22px 18px 10px; }.insight-avatar { display: grid; width: 52px; height: 52px; place-items: center; border-radius: 50%; background: linear-gradient(145deg, #5e759f, #2b3e65); color: white; font-weight: 700; }.insight-profile h3 { margin: 0 0 4px; color: #243250; font-size: 16px; }.insight-profile p, .insight-meta { margin: 0; color: #8993a3; font-size: 12px; }.insight-meta { padding: 0 18px; }
.insight-state-row { display: flex; gap: 10px; padding: 14px 18px 16px; border-bottom: 1px solid #eef0f3; color: #778399; font-size: 12px; }.online-state { display: inline-flex; align-items: center; gap: 5px; color: #929baa; }.online-state::before { width: 6px; height: 6px; border-radius: 50%; background: currentColor; content: ''; }.online-state--active { color: #22b66e; }
.insight-tabs { flex: 1; padding: 0 18px; }.profile-fields { margin: 4px 0 0; }.profile-fields div { display: grid; gap: 4px; padding: 12px 0; border-bottom: 1px solid #f0f2f5; }.profile-fields dt { color: #8a95a7; font-size: 12px; }.profile-fields dd { overflow: hidden; margin: 0; color: #34425c; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }.account-state-card { margin-top: 16px; padding: 16px; border: 1px solid #e8ecf3; border-radius: 10px; background: #fafbfd; }.account-state-card span, .account-state-card p { display: block; margin: 0; color: #8490a4; font-size: 12px; }.account-state-card strong { display: block; margin: 7px 0; color: #1e3153; font-size: 18px; }.account-state-card p { line-height: 1.65; }
.insight-empty { display: grid; flex: 1; align-content: center; justify-items: center; padding: 32px; text-align: center; }.insight-empty h3 { margin: 14px 0 6px; color: #30405e; font-size: 15px; }.insight-empty p { margin: 0; color: #8c96a7; font-size: 12px; line-height: 1.7; }.empty-orbit { position: relative; width: 82px; height: 82px; border: 1px solid #dfe6f3; border-radius: 50%; }.empty-orbit::before { position: absolute; top: 38px; left: -10px; width: 100px; height: 1px; background: #f0c492; content: ''; transform: rotate(-28deg); }.empty-orbit i, .empty-orbit b { position: absolute; border-radius: 50%; content: ''; }.empty-orbit i { top: 15px; right: 16px; width: 9px; height: 9px; background: #6b82b7; }.empty-orbit b { bottom: 13px; left: 17px; width: 6px; height: 6px; background: #eaa253; }
@media (max-width: 1180px) { .community-users-page { grid-template-columns: 1fr; overflow-y: auto; }.user-insight { min-height: 300px; }.users-filters { grid-template-columns: minmax(190px, 1fr) repeat(2, minmax(120px, .7fr)) auto auto; } }
@media (max-width: 800px) { .community-users-page { height: auto; min-height: 100%; padding: 12px; }.users-filters, .user-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.users-filters .n-button { justify-self: start; }.list-caption-hint { display: none; } }
@media (max-width: 520px) { .users-filters, .user-metrics { grid-template-columns: 1fr; }.users-heading h1 { font-size: 22px; } }
</style>
