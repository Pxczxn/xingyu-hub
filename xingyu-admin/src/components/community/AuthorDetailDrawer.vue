<template>
  <n-drawer v-model:show="show" :width="420">
    <n-drawer-content :title="drawerTitle">
      <template v-if="author && isCommunityUser">
        <section class="insight-profile">
          <div class="insight-avatar" aria-hidden="true">{{ avatarLetter }}</div>
          <div>
            <h3>{{ authorLabel }}</h3>
            <p>ID: {{ author.authorId || '-' }}</p>
          </div>
        </section>
        <p class="insight-meta">加入时间 {{ author.createdAt || '暂未记录' }}</p>
        <div class="insight-state-row">
          <n-tag :type="statusMeta.type" size="small" round>{{ statusMeta.label }}</n-tag>
          <span>{{ roleLabel }}</span>
        </div>

        <n-tabs type="line" animated class="insight-tabs">
          <n-tab-pane name="profile" tab="资料与验证">
            <dl class="profile-fields">
              <div><dt>邮箱</dt><dd>{{ author.authorEmail || '未填写' }}</dd></div>
              <div><dt>邮箱验证</dt><dd>{{ author.emailVerified ? '已验证' : '未验证' }}</dd></div>
              <div><dt>手机号</dt><dd>{{ author.phone || '未填写' }}</dd></div>
              <div><dt>手机验证</dt><dd>{{ author.phoneVerified ? '已验证' : '未验证' }}</dd></div>
              <div v-if="author.authorBio"><dt>简介</dt><dd class="profile-fields__bio">{{ author.authorBio }}</dd></div>
            </dl>
          </n-tab-pane>
          <n-tab-pane name="account" tab="账号状态">
            <div class="account-state-card">
              <span>当前账号状态</span>
              <strong>{{ statusMeta.label }}</strong>
              <p>审核与账号状态由社区审核流程维护。</p>
            </div>
          </n-tab-pane>
        </n-tabs>
      </template>

      <n-descriptions v-else-if="author" bordered :column="1">
        <n-descriptions-item :label="AUTHOR_COLUMN_TITLE">
          {{ authorLabel }}
        </n-descriptions-item>
        <n-descriptions-item label="用户 ID">
          {{ author.authorId || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="邮箱">
          {{ author.authorEmail || '-' }}
        </n-descriptions-item>
        <n-descriptions-item label="简介">
          {{ author.authorBio || '-' }}
        </n-descriptions-item>
      </n-descriptions>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  AUTHOR_COLUMN_TITLE,
  COMMUNITY_USER_STATUS_META,
  formatAuthorLabel,
  formatCommunityUserRole,
  resolveStatusLabel
} from '@/utils/community-display'

export interface AuthorDetail {
  authorId?: string
  authorDisplayName?: string
  authorUsername?: string
  authorLabel?: string
  authorName?: string
  authorEmail?: string
  authorBio?: string
  status?: string
  role?: string
  phone?: string | null
  emailVerified?: boolean
  phoneVerified?: boolean
  createdAt?: string | null
}

const show = defineModel<boolean>('show', { required: true })

const props = defineProps<{
  author?: AuthorDetail | null
}>()

const isCommunityUser = computed(() => props.author?.status !== undefined && props.author?.status !== '')

const drawerTitle = computed(() => (isCommunityUser.value ? '用户洞察' : '作者信息'))

const authorLabel = computed(() =>
  formatAuthorLabel(
    props.author?.authorDisplayName,
    props.author?.authorUsername,
    props.author?.authorLabel || props.author?.authorName
  )
)

const avatarLetter = computed(() => {
  const seed = props.author?.authorDisplayName || props.author?.authorUsername || props.author?.authorEmail || '?'
  return seed.slice(0, 1).toUpperCase()
})

const statusMeta = computed(() =>
  resolveStatusLabel(props.author?.status, COMMUNITY_USER_STATUS_META)
)

const roleLabel = computed(() => formatCommunityUserRole(props.author?.role))
</script>

<style scoped lang="scss">
.insight-profile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 10px;
}

.insight-avatar {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #5e759f, #2b3e65);
  color: white;
  font-weight: 700;
}

.insight-profile h3 {
  margin: 0 0 4px;
  color: #243250;
  font-size: 16px;
}

.insight-profile p,
.insight-meta {
  margin: 0;
  color: #8993a3;
  font-size: 12px;
}

.insight-meta {
  padding-top: 4px;
}

.insight-state-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px 0 16px;
  border-bottom: 1px solid #eef0f3;
  color: #778399;
  font-size: 12px;
}

.insight-tabs {
  padding-top: 4px;
}

.profile-fields {
  margin: 4px 0 0;
}

.profile-fields div {
  display: grid;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f5;
}

.profile-fields dt {
  color: #8a95a7;
  font-size: 12px;
}

.profile-fields dd {
  overflow: hidden;
  margin: 0;
  color: #34425c;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-fields__bio {
  white-space: normal;
  line-height: 1.55;
}

.account-state-card {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #e8ecf3;
  border-radius: 10px;
  background: #fafbfd;
}

.account-state-card span,
.account-state-card p {
  display: block;
  margin: 0;
  color: #8490a4;
  font-size: 12px;
}

.account-state-card strong {
  display: block;
  margin: 7px 0;
  color: #1e3153;
  font-size: 18px;
}

.account-state-card p {
  line-height: 1.65;
}
</style>
