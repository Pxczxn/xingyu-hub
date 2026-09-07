import type { TagProps } from 'naive-ui'
import type { ContentAsset } from '@/api/operations'
import { resolveContentStatus, AUTHOR_COLUMN_TITLE } from '@/utils/community-display'

export type ContentAssetType = 'ARTICLE' | 'MOMENT' | 'SERIES'

export interface StatusOption {
  label: string
  value: string
}

export interface StatusAction {
  from: string
  to: string
  label: string
  confirm: string
  buttonType?: 'primary' | 'warning' | 'error' | 'default'
}

export interface ContentAssetScreenConfig {
  eyebrow: string
  description: string
  searchPlaceholder: string
  emptyDescription: string
  hint?: string
  reviewLink?: string
  statusOptions: StatusOption[]
  statusMeta: Record<string, { label: string; type?: TagProps['type'] }>
  statusActions: StatusAction[]
  primaryLabelKey: string
  detailFields: Array<{ label: string; key: keyof ContentAsset | 'summary' }>
}

export const contentAssetConfigs: Record<ContentAssetType, ContentAssetScreenConfig> = {
  ARTICLE: {
    eyebrow: '星语社区 · 文章运营',
    description: '管理公开文章的展示资格、精选引用与受控状态；待审核内容请走「内容审核」流程。',
    searchPlaceholder: '搜索文章标题',
    emptyDescription: '暂无符合条件的文章',
    hint: '处于「审核中」的文章请在「内容审核」中处理；本页仅用于运营查看与状态跟踪。',
    reviewLink: '/community/review',
    primaryLabelKey: 'title',
    statusOptions: [
      { label: '草稿', value: 'DRAFT' },
      { label: '审核中', value: 'IN_REVIEW' },
      { label: '已发布', value: 'PUBLISHED' }
    ],
    statusMeta: {
      DRAFT: { label: '草稿', type: 'info' },
      IN_REVIEW: { label: '审核中', type: 'warning' },
      PUBLISHED: { label: '已发布', type: 'success' }
    },
    statusActions: [],
    detailFields: [
      { label: '编号', key: 'id' },
      { label: '标题', key: 'title' },
      { label: AUTHOR_COLUMN_TITLE, key: 'authorLabel' },
      { label: '摘要', key: 'summary' },
      { label: '正文', key: 'body' },
      { label: '状态', key: 'status' },
      { label: '更新时间', key: 'updatedAt' }
    ]
  },
  MOMENT: {
    eyebrow: '星语社区 · 动态运营',
    description: '关注公开讨论质量，查看动态正文摘要并执行回收或恢复。',
    searchPlaceholder: '搜索动态正文',
    emptyDescription: '暂无符合条件的动态',
    primaryLabelKey: 'title',
    statusOptions: [
      { label: '已发布', value: 'PUBLISHED' },
      { label: '已回收', value: 'TRASHED' }
    ],
    statusMeta: {
      PUBLISHED: { label: '已发布', type: 'success' },
      TRASHED: { label: '已回收', type: 'default' }
    },
    statusActions: [
      {
        from: 'PUBLISHED',
        to: 'TRASHED',
        label: '回收',
        confirm: '确认将该动态移入回收状态？',
        buttonType: 'warning'
      },
      {
        from: 'TRASHED',
        to: 'PUBLISHED',
        label: '恢复',
        confirm: '确认恢复该动态的公开状态？',
        buttonType: 'primary'
      }
    ],
    detailFields: [
      { label: '编号', key: 'id' },
      { label: '正文摘要', key: 'title' },
      { label: AUTHOR_COLUMN_TITLE, key: 'authorLabel' },
      { label: '正文', key: 'body' },
      { label: '状态', key: 'status' },
      { label: '更新时间', key: 'updatedAt' }
    ]
  },
  SERIES: {
    eyebrow: '星语社区 · 系列运营',
    description: '维护系列目录、章节可见性与推荐资格，支持归档与恢复。',
    searchPlaceholder: '搜索系列标题或简介',
    emptyDescription: '暂无符合条件的系列',
    primaryLabelKey: 'title',
    statusOptions: [
      { label: '草稿', value: 'DRAFT' },
      { label: '审核中', value: 'IN_REVIEW' },
      { label: '已发布', value: 'PUBLISHED' },
      { label: '运营中', value: 'ACTIVE' },
      { label: '已归档', value: 'ARCHIVED' }
    ],
    statusMeta: {
      DRAFT: { label: '草稿', type: 'info' },
      IN_REVIEW: { label: '审核中', type: 'warning' },
      PUBLISHED: { label: '已发布', type: 'success' },
      ACTIVE: { label: '运营中', type: 'success' },
      ARCHIVED: { label: '已归档', type: 'default' }
    },
    statusActions: [
      {
        from: 'ACTIVE',
        to: 'ARCHIVED',
        label: '归档',
        confirm: '确认归档该系列？归档后将从公开推荐中移除。',
        buttonType: 'warning'
      },
      {
        from: 'ARCHIVED',
        to: 'ACTIVE',
        label: '恢复',
        confirm: '确认恢复该系列的运营状态？',
        buttonType: 'primary'
      }
    ],
    detailFields: [
      { label: '编号', key: 'id' },
      { label: '标题', key: 'title' },
      { label: AUTHOR_COLUMN_TITLE, key: 'authorLabel' },
      { label: '简介', key: 'summary' },
      { label: '章节数', key: 'chapterCount' },
      { label: '状态', key: 'status' },
      { label: '更新时间', key: 'updatedAt' }
    ]
  }
}

export function getContentAssetConfig(type: string): ContentAssetScreenConfig {
  return contentAssetConfigs[type as ContentAssetType] ?? contentAssetConfigs.ARTICLE
}

export function formatAssetStatus(config: ContentAssetScreenConfig, status?: string) {
  return resolveContentStatus(config.statusMeta, status)
}

export function findStatusAction(config: ContentAssetScreenConfig, status?: string) {
  return config.statusActions.find((action) => action.from === status)
}
