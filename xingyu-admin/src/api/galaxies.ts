import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface Galaxy {
  id: string
  slug: string
  name: string
  official: boolean
  memberCount?: number
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
  create(data: { name: string; slug: string; seedKey?: string; official?: boolean }): Promise<Galaxy> {
    return request({ url: '/community/galaxies', method: 'post', data })
  },
  update(galaxyId: string, data: Partial<Pick<Galaxy, 'name' | 'official'>>): Promise<Galaxy> {
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
