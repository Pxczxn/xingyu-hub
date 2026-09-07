import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface GuidePage {
  id: string
  slug: string
  title: string
  body: string
  sortOrder: number
  status: string
}

export const guidePageApi = {
  list(): Promise<GuidePage[]> {
    return request({ url: '/community/guide-pages', method: 'get' }).then(asApiList<GuidePage>)
  },
  create(data: Partial<GuidePage>): Promise<GuidePage> {
    return request({ url: '/community/guide-pages', method: 'post', data })
  },
  update(pageId: string, data: Partial<GuidePage>): Promise<GuidePage> {
    return request({ url: `/community/guide-pages/${pageId}`, method: 'patch', data })
  }
}
