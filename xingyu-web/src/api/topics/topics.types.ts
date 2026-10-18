/*
 * Topics domain types (extracted from the Legacy community API module — NOT the whole file).
 */

import type { ContentSummary } from "@/api/common.types";

export type TopicSummary = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  followerCount?: number;
  contentCount?: number;
  following?: boolean;
  /**
   * 该话题下最新一篇公开文章的发布时间（`published_revision.published_at`）。
   *
   * 不是 `indexed_at`：后者是索引写入时间，重建索引就会刷新，不能当内容时间。
   * 没有公开文章的话题为 null / 缺失 —— 广场的「最近活跃」据此整条不渲染，
   * 而不是显示一个无法验证的时间。
   */
  lastPublishedAt?: string | null;
};

export type TopicCreatorSummary = {
  username: string;
  displayName?: string;
  contentCount: number;
};

export type TopicContentSort = "latest" | "hot";

export type { ContentSummary };
