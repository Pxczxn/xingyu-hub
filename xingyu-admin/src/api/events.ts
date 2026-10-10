import { request } from '@/utils/request'
import { asApiList } from '@/utils/api-data'

export interface CommunityEvent {
  id: string
  slug: string
  title: string
  body: string
  status: string
  submissionOpen: boolean
  startsAt?: string
  endsAt?: string
}

export interface EventSubmission {
  id: string
  eventId: string
  authorId?: string
  authorUsername?: string
  authorDisplayName?: string
  objectType: string
  objectId: string
  objectTitle?: string
  note?: string
  status: string
  createdAt?: string
}

export const eventApi = {
  list(limit = 100): Promise<CommunityEvent[]> {
    return request({ url: '/community/events', method: 'get', params: { limit } }).then(asApiList<CommunityEvent>)
  },
  /**
   * `status` is restricted server-side to the domain's real vocabulary
   * (ACTIVE / ARCHIVED); anything else is rejected rather than persisted.
   * `endsAt: null` explicitly clears the auto-end time.
   */
  create(data: Partial<CommunityEvent>): Promise<CommunityEvent> {
    return request({ url: '/community/events', method: 'post', data })
  },
  update(eventId: string, data: Partial<CommunityEvent> & { endsAt?: string | null }): Promise<CommunityEvent> {
    return request({ url: `/community/events/${eventId}`, method: 'patch', data })
  },
  listSubmissions(eventId: string, limit = 100): Promise<EventSubmission[]> {
    return request({ url: `/community/events/${eventId}/submissions`, method: 'get', params: { limit } }).then(asApiList<EventSubmission>)
  },
  reviewSubmission(submissionId: string, status: 'ACCEPTED' | 'REJECTED'): Promise<EventSubmission> {
    return request({ url: `/community/events/submissions/${submissionId}/review`, method: 'post', data: { status } })
  }
}