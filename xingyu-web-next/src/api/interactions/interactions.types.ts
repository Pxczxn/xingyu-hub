/*
 * Interaction domain types (like / bookmark / comments).
 * Shapes verified against the live backend on 2026-09-21.
 */

export type CommentItem = {
  id: string;
  authorId: string;
  authorUsername?: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
};

export type LikeStatus = { liked: boolean };
export type LikeCount = { count: number };
export type BookmarkStatus = { bookmarked: boolean };

export type CreateCommentPayload = {
  objectType: string;
  objectId: string;
  body: string;
  parentId?: string;
};

/** Object types accepted by the interaction endpoints. */
export type InteractionObjectType = "ARTICLE" | "SERIES" | "MOMENT";
