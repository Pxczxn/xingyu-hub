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

/**
 * 成员推荐记录（Galaxy Content Contribution，V054）。
 *
 * 审核端只看 PENDING；`title` 取自活文档，作品下架后为 null —— 列表按「内容不可用」
 * 降级，不能沿用旧标题。通过时后端会重新校验作品是否仍可公开：已下架返回
 * 业务冲突（code 409），所以「通过」失败要如实提示，不能乐观地把行从待审里删掉。
 */
export interface GalaxyContentSubmission {
  id: string
  galaxyId: string
  galaxySlug: string
  galaxyName: string
  objectType: string
  objectId: string
  title?: string | null
  summary?: string | null
  submitterId: string
  submitterName: string
  note?: string | null
  status: string
  rejectReason?: string | null
  createdAt: string
  resolvedAt?: string | null
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
  },
  /** 待审推荐：只返回 PENDING（服务端已按状态过滤）。 */
  listContentSubmissions(galaxyId: string): Promise<GalaxyContentSubmission[]> {
    return request({ url: `/community/galaxies/${galaxyId}/content-submissions`, method: 'get' }).then(
      asApiList<GalaxyContentSubmission>
    )
  },
  approveContentSubmission(submissionId: string): Promise<void> {
    return request({ url: `/community/galaxies/content-submissions/${submissionId}/approve`, method: 'post' })
  },
  /** 必须给理由：作者需要知道为什么被拒。 */
  rejectContentSubmission(submissionId: string, reason: string): Promise<void> {
    return request({
      url: `/community/galaxies/content-submissions/${submissionId}/reject`,
      method: 'post',
      data: { reason }
    })
  }
}
