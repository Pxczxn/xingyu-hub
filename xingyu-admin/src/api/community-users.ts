import request from '@/utils/request'
import { asApiRecord, asMarsPage, type MarsPageResult } from '@/utils/api-data'

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

export interface CommunityUserStatistics {
  totalUsers: number
  pendingReview: number
  active: number
  attention: number
}

export const communityUsersApi = {
  list(params?: {
    page?: number
    pageSize?: number
    status?: string
    keyword?: string
    role?: string
  }): Promise<MarsPageResult<CommunityUserItem>> {
    return request({ url: '/community/users', method: 'get', params }).then(asMarsPage<CommunityUserItem>)
  },
  statistics(): Promise<CommunityUserStatistics> {
    return request({ url: '/community/users/statistics', method: 'get' })
      .then(asApiRecord<CommunityUserStatistics & Record<string, unknown>>)
  },
  approve(userId: string): Promise<void> {
    return request({ url: `/community/users/${userId}/approve`, method: 'post' })
  },
  reject(userId: string): Promise<void> {
    return request({ url: `/community/users/${userId}/reject`, method: 'post' })
  },
  resetPassword(userId: string): Promise<{
    mailPending?: boolean
    mailError?: string | null
    recipientEmail?: string | null
    tempPassword?: string | null
  }> {
    return request({ url: `/community/users/${userId}/reset-password`, method: 'post' }).then(asApiRecord)
  }
}
