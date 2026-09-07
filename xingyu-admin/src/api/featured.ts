import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface FeaturedContent {
  id: string
  objectType: string
  objectId: string
  title?: string
  sortOrder?: number
  status: string
  createdAt?: string
}

export const featuredApi = {
  list(limit = 100): Promise<FeaturedContent[]> {
    return request({ url: '/community/featured', method: 'get', params: { limit } }).then(asApiList<FeaturedContent>)
  },
  create(data: { objectType: string; objectId: string; sortOrder?: number }): Promise<FeaturedContent> {
    return request({ url: '/community/featured', method: 'post', data })
  },
  archive(featuredId: string): Promise<void> {
    return request({ url: `/community/featured/${featuredId}`, method: 'delete' })
  }
}
