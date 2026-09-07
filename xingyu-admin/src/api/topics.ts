import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface Topic {
  id: string
  seedKey: string
  slug: string
  name: string
  description?: string | null
  status: 'ACTIVE' | 'ENABLED' | 'DISABLED' | 'MERGED'
  parentTopicId?: string | null
  followerCount?: number
  contentCount?: number
}

export const topicApi = {
  list(params?: { keyword?: string; status?: string }): Promise<Topic[]> {
    return request({ url: '/topics', method: 'get', params }).then(asApiList<Topic>)
  },
  create(data: { slug: string; name: string; seedKey?: string; description?: string }): Promise<Topic> {
    return request({ url: '/topics', method: 'post', data })
  },
  update(
    topicId: string,
    data: Partial<Pick<Topic, 'slug' | 'name' | 'status' | 'description'>>
  ): Promise<Topic> {
    return request({ url: `/topics/${topicId}`, method: 'patch', data })
  },
  listAliases(topicId: string): Promise<Array<{ id: string; aliasSlug: string }>> {
    return request({ url: `/topics/${topicId}/aliases`, method: 'get' }).then(asApiList)
  },
  addAlias(topicId: string, aliasSlug: string) {
    return request({ url: `/topics/${topicId}/aliases`, method: 'post', data: { aliasSlug } })
  },
  setParent(topicId: string, parentTopicId: string | null) {
    return request({ url: `/topics/${topicId}/parent`, method: 'patch', data: { parentTopicId } })
  },
  merge(sourceTopicId: string, targetTopicId: string) {
    return request({ url: `/topics/${sourceTopicId}/merge`, method: 'post', data: { targetTopicId } })
  }
}
