import request from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface ReviewQueueItem {
  submissionId: string
  articleId: string
  title: string
  submittedBy: string
  authorId?: string
  authorDisplayName?: string
  authorUsername?: string
  authorLabel?: string
  summary?: string
  body?: string
  submittedAt: string
}

export const reviewApi = {
  queue(): Promise<ReviewQueueItem[]> {
    return request({ url: '/review/queue', method: 'get' }).then(asApiList<ReviewQueueItem>)
  },
  decide(submissionId: string, decision: string, comment?: string): Promise<void> {
    return request({
      url: `/review/${submissionId}/decide`,
      method: 'post',
      data: { decision, comment }
    })
  }
}
