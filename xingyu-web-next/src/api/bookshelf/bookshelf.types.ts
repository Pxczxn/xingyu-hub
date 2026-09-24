/*
 * Bookshelf = series subscriptions, NOT collections.
 * VERIFIED live 2026-09-24: PageResult keys are items / nextCursor / total.
 * There is no hasMore field. cursor is accepted but not proven to page.
 */

export type BookshelfCard = {
  id: string;
  objectType?: string;
  title: string;
  summary?: string | null;
  cover?: string | null;
  authorName?: string | null;
  updatedAt?: string | null;
};

export type BookshelfPage = {
  items: BookshelfCard[];
  nextCursor: string | null;
  total: number;
};

export type BookshelfQuery = {
  limit?: number;
  cursor?: string;
};
