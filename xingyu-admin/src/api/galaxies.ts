import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface Galaxy {
  id: string
  slug: string
  name: string
  official: boolean
  memberCount?: number
  /** OPEN 直入 / APPROVAL 需申请（Galaxy Identity Contract） */
  joinMode?: string
  /** V051；null = 未填写 */
  description?: string | null
  /** V051；null = 未填写（社区端回退装饰图） */
  coverUrl?: string | null
  /** 可见内容数（过滤治理隐藏），仅详情语义；列表由服务端决定是否携带 */
  contentCount?: number
}

export interface GalaxyContent {
  id: string
  objectType: string
  objectId: string
  title?: string
  pinned: boolean
}

export const galaxyApi = {
  list(): Promise<Galaxy[]> {
    return request({ url: '/community/galaxies', method: 'get' }).then(asApiList<Galaxy>)
  },
  create(data: {
    name: string
    slug: string
    seedKey?: string
    official?: boolean
    joinMode?: string
    description?: string | null
    coverUrl?: string | null
  }): Promise<Galaxy> {
    return request({ url: '/community/galaxies', method: 'post', data })
  },
  update(
    galaxyId: string,
    data: Partial<Pick<Galaxy, 'name' | 'official' | 'joinMode' | 'description' | 'coverUrl'>>
  ): Promise<Galaxy> {
    return request({ url: `/community/galaxies/${galaxyId}`, method: 'patch', data })
  },
  listContent(slug: string): Promise<GalaxyContent[]> {
    return request({ url: `/community/galaxies/${slug}/content`, method: 'get' }).then(asApiList<GalaxyContent>)
  },
  addContent(galaxyId: string, data: { objectType: string; objectId: string; pinned?: boolean }): Promise<GalaxyContent> {
    return request({ url: `/community/galaxies/${galaxyId}/content`, method: 'post', data })
  },
  removeContent(contentId: string): Promise<void> {
    return request({ url: `/community/galaxies/content/${contentId}`, method: 'delete' })
  }
}
