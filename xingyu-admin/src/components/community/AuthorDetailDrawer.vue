<template>
  <n-drawer v-model:show="show" :width="420">
    <n-drawer-content title="作者信息">
      <n-descriptions v-if="author" bordered :column="1">
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
import { formatAuthorLabel, AUTHOR_COLUMN_TITLE } from '@/utils/community-display'

export interface AuthorDetail {
  authorId?: string
  authorDisplayName?: string
  authorUsername?: string
  authorLabel?: string
  authorName?: string
  authorEmail?: string
  authorBio?: string
}

const show = defineModel<boolean>('show', { required: true })

const props = defineProps<{
  author?: AuthorDetail | null
}>()

const authorLabel = computed(() =>
  formatAuthorLabel(
    props.author?.authorDisplayName,
    props.author?.authorUsername,
    props.author?.authorLabel || props.author?.authorName
  )
)
</script>
