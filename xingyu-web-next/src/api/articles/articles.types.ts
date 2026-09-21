/*
 * Article domain types.
 * Shape verified against the live backend GET /api/v1/articles/{id} (2026-09-21).
 */

export type ArticleDetail = {
  id: string;
  title: string;
  summary: string | null;
  coverUrl?: string | null;
  bodyMode?: string;
  body: string;
  slug: string | null;
  visibility: string;
  spaceSlug: string;
  ownerUsername: string;
  ownerAvatar?: string | null;
  ownerDisplayName?: string | null;
  publishedAt: string | null;
  owner: boolean;
  categorySlug?: string | null;
  topicSlugs?: string[];
};
