import request from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface ModerationCase {
  id: string
  reportId: string
  objectType: string
  objectId: string
  status: string
  reason?: string
  createdAt: string
}

export const moderationApi = {
  listCases(): Promise<ModerationCase[]> {
    return request({ url: '/moderation/cases', method: 'get' }).then(asApiList<ModerationCase>)
  },
  decide(caseId: string, decision: string, comment?: string): Promise<void> {
    return request({
      url: `/moderation/cases/${caseId}/decide`,
      method: 'post',
      data: { decision, comment }
    })
  }
}
