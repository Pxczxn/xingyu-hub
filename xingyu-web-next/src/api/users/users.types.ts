/*
 * User / profile domain types.
 * Shapes verified against the live backend GET /api/v1/users/{username} (2026-09-21).
 */

export type ProfileDetail = {
  username: string;
  displayName?: string | null;
  bio?: string | null;
  avatar?: string | null;
  websiteUrl?: string | null;
  visibility?: string;
  followersVisibility?: string;
  lockVersion?: number;
  followerCount?: number;
  followingCount?: number;
  canViewFollowLists?: boolean;
  owner?: boolean;
  following?: boolean;
  spaceSlug?: string | null;
  spaceDisplayName?: string | null;
  articleCount?: number;
  seriesCount?: number;
};

export type SpaceWorkItem = {
  id: string;
  title: string;
  categorySlug?: string | null;
  summary?: string | null;
  coverUrl?: string | null;
};

export type SpaceWorks = {
  username: string;
  spaceSlug: string;
  displayName?: string | null;
  description?: string | null;
  owner: boolean;
  categories: Array<{ id: string; name: string; slug: string }>;
  works: SpaceWorkItem[];
  nextCursor?: string | null;
};

export type FollowUser = {
  userId: string;
  username: string;
  displayName?: string | null;
  followedAt?: string;
};
