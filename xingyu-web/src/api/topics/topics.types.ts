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
};

export type TopicCreatorSummary = {
  username: string;
  displayName?: string;
  contentCount: number;
};

export type TopicContentSort = "latest" | "hot";

export type { ContentSummary };
