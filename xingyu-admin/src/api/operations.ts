import { request, apiPage, apiRecord } from '@/utils/api-request'

export interface OperationsOverview {
  pendingReviewCount: number
  openCaseCount: number
  publishedArticleCount: number
  activeEventCount: number
}

export interface ContentAsset {
  id: string | number
  type?: string
  title?: string
  summary?: string
  body?: string
  slug?: string
  chapterCount?: number
  status?: string
  authorId?: string
  authorDisplayName?: string
  authorUsername?: string
  authorLabel?: string
  authorEmail?: string
  authorBio?: string
  authorName?: string
  updatedAt?: string
  createdAt?: string
  [key: string]: unknown
}

export interface ContentAssetPage {
  records: ContentAsset[]
  total: number
  page: number
  pageSize: number
}

/** 社区运营聚合数据，仅用于运营总览。 */
export const operationsApi = {
  getOverview(): Promise<OperationsOverview> {
    return apiRecord<OperationsOverview>({ url: '/operations/overview', method: 'get' })
  },
  listContent(params: { type: string; keyword?: string; status?: string; page?: number; pageSize?: number }): Promise<ContentAssetPage> {
    return apiPage<ContentAsset>({ url: '/operations/content', method: 'get', params }, params.pageSize ?? 20).then((page) => ({
      records: page.list,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize
    }))
  },
  getContentDetail(id: string | number, type: string, options?: { silent?: boolean }): Promise<ContentAsset> {
    return apiRecord<ContentAsset>({
      url: `/operations/content/${id}`,
      method: 'get',
      params: { type },
      silentError: options?.silent
    })
  },
  updateContentStatus(id: string | number, data: { type: string; status: string; reason?: string }): Promise<void> {
    return request({ url: `/operations/content/${id}/status`, method: 'patch', data })
  }
}
