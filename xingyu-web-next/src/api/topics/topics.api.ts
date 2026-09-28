/*
 * Topics domain API (extracted from the Legacy community API module — NOT the whole file).
 * Endpoints:
 *   GET    /api/v1/topics
 *   GET    /api/v1/topics/{slug}
 *   GET    /api/v1/topics/{slug}/content
 *   GET    /api/v1/topics/{slug}/creators
 *   POST   /api/v1/follows/topics/{topicId}
 *   DELETE /api/v1/follows/topics/{topicId}
 */
import { apiRequest } from "@/api/client";
import type { ContentSummary } from "@/api/common.types";
import type { TopicContentSort, TopicCreatorSummary, TopicSummary } from "./topics.types";

export const topicsApi = {
  getTopics: (keyword?: string): Promise<TopicSummary[]> =>
    apiRequest<TopicSummary[]>(
      keyword ? `/api/v1/topics?keyword=${encodeURIComponent(keyword)}` : "/api/v1/topics",
    ),

  getTopic: (slug: string): Promise<TopicSummary> =>
    apiRequest<TopicSummary>(`/api/v1/topics/${encodeURIComponent(slug)}`),

  getTopicContent: (slug: string, sort: TopicContentSort = "latest", limit = 12): Promise<ContentSummary[]> =>
    apiRequest<ContentSummary[]>(
      `/api/v1/topics/${encodeURIComponent(slug)}/content?sort=${encodeURIComponent(sort)}&limit=${encodeURIComponent(String(limit))}`,
    ),

  getTopicCreators: (slug: string, limit = 12): Promise<TopicCreatorSummary[]> =>
    apiRequest<TopicCreatorSummary[]>(
      `/api/v1/topics/${encodeURIComponent(slug)}/creators?limit=${encodeURIComponent(String(limit))}`,
    ),

  followTopic: (topicId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/follows/topics/${encodeURIComponent(topicId)}`, { method: "POST" }),

  unfollowTopic: (topicId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/follows/topics/${encodeURIComponent(topicId)}`, { method: "DELETE" }),
};
