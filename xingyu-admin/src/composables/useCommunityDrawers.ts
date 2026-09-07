import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { operationsApi, type ContentAsset } from '@/api/operations'
import {
  buildDetailFields,
  formatAuthorLabel,
  formatObjectType,
  resolveStatusLabel
} from '@/utils/community-display'

export function useContentDetailDrawer() {
  const message = useMessage()
  const showDetail = ref(false)
  const detailLoading = ref(false)
  const detailTitle = ref('内容详情')
  const detailFields = ref<Array<{ label: string; value: string; multiline?: boolean }>>([])

  function openLocalContent(row: Record<string, unknown>, title?: string) {
    detailTitle.value = title || String(row.title || row.name || '内容详情')
    detailFields.value = buildDetailFields([
      { label: '编号', value: row.id as string },
      { label: '标题', value: row.title as string },
      { label: '名称', value: row.name as string },
      { label: '别名', value: row.slug as string },
      { label: '类型', value: formatObjectType(row.objectType as string || row.type as string) },
      { label: '摘要', value: row.summary as string },
      { label: '正文', value: row.body as string, multiline: true },
      { label: '简介', value: row.description as string, multiline: true },
      {
        label: '状态',
        value: resolveStatusLabel(row.status as string).label
      },
      { label: '更新时间', value: row.updatedAt as string },
      { label: '创建时间', value: row.createdAt as string },
      { label: '发布时间', value: row.publishedAt as string }
    ])
    showDetail.value = true
  }

  function openMissingContent(objectType: string, objectId: string, title = '关联内容') {
    detailTitle.value = title
    detailFields.value = buildDetailFields([
      { label: '对象类型', value: formatObjectType(objectType) },
      { label: '对象 ID', value: objectId },
      { label: '说明', value: '关联内容已删除或不存在' }
    ])
    showDetail.value = true
  }

  async function openRemoteContent(
    objectType: string,
    objectId: string,
    fallbackTitle?: string,
    options?: { missingTitle?: string }
  ): Promise<boolean> {
    detailLoading.value = true
    try {
      const asset = await operationsApi.getContentDetail(objectId, objectType, { silent: true })
      detailTitle.value = String(asset.title || fallbackTitle || '内容详情')
      detailFields.value = buildDetailFields([
        { label: '编号', value: asset.id as string },
        { label: '标题', value: asset.title },
        { label: '类型', value: formatObjectType(asset.type || objectType) },
        { label: '作者', value: formatAuthorLabel(asset.authorDisplayName, asset.authorUsername, asset.authorLabel) },
        { label: '摘要', value: asset.summary },
        { label: '正文', value: asset.body, multiline: true },
        { label: '状态', value: resolveStatusLabel(asset.status).label },
        { label: '更新时间', value: asset.updatedAt }
      ])
      showDetail.value = true
      return true
    } catch (error) {
      const notFound = error instanceof Error && error.message.includes('内容不存在')
      if (notFound) {
        openMissingContent(objectType, objectId, options?.missingTitle)
        return false
      }
      message.error('内容详情加载失败')
      return false
    } finally {
      detailLoading.value = false
    }
  }

  return {
    showDetail,
    detailLoading,
    detailTitle,
    detailFields,
    openLocalContent,
    openRemoteContent
  }
}

export function useAuthorDetailDrawer() {
  const showAuthor = ref(false)
  const selectedAuthor = ref<ContentAsset | Record<string, unknown> | null>(null)

  function openAuthor(author: ContentAsset | Record<string, unknown>) {
    selectedAuthor.value = {
      authorId: (author.authorId || author.id) as string | undefined,
      authorDisplayName: author.authorDisplayName || author.displayName as string | undefined,
      authorUsername: author.authorUsername || author.username as string | undefined,
      authorLabel: author.authorLabel as string | undefined,
      authorName: author.authorName as string | undefined,
      authorEmail: author.authorEmail || author.email as string | undefined,
      authorBio: author.authorBio || author.bio as string | undefined
    }
    showAuthor.value = true
  }

  return { showAuthor, selectedAuthor, openAuthor }
}
