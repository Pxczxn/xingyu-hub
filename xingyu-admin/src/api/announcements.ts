import request from '@/utils/request'
import { asApiList } from '@/utils/api-data'
export interface Announcement { id: string; title: string; body: string; status: string; createdAt?: string; publishedAt?: string }
export const announcementApi = {
  list: (): Promise<Announcement[]> => request({ url: '/operations/announcements', method: 'get' }).then(asApiList<Announcement>),
  create: (data: { title: string; body: string }): Promise<Announcement> => request({ url: '/operations/announcements', method: 'post', data }),
  updateStatus: (id: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'): Promise<Announcement> =>
    request({ url: `/operations/announcements/${id}`, method: 'patch', data: { status } })
}
