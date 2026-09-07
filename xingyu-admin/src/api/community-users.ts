import request from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface CommunityUserItem {
  id: string
  email: string
  username?: string | null
  displayName?: string | null
  phone?: string | null
  status: string
  role: string
  emailVerified: boolean
  phoneVerified: boolean
  createdAt?: string | null
}

export const communityUsersApi = {
  list(params?: {
    status?: string
    username?: string
    email?: string
    phone?: string
    keyword?: string
    limit?: number
  }): Promise<CommunityUserItem[]> {
    return request({ url: '/community/users', method: 'get', params }).then(asApiList<CommunityUserItem>)
  },
  approve(userId: string): Promise<void> {
    return request({ url: `/community/users/${userId}/approve`, method: 'post' })
  },
  reject(userId: string): Promise<void> {
    return request({ url: `/community/users/${userId}/reject`, method: 'post' })
  }
}
