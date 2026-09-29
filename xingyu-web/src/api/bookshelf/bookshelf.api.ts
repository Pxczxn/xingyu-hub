/*
 * GET /api/v1/me/bookshelf — series subscriptions (Phase 2C).
 * Distinct from collections. No subscribe/unsubscribe in this phase.
 */
import { apiRequest } from "@/api/client";
import type { BookshelfPage, BookshelfQuery } from "./bookshelf.types";

export const bookshelfApi = {
  list: (query: BookshelfQuery = {}): Promise<BookshelfPage> => {
    const params = new URLSearchParams();
    if (query.limit != null) params.set("limit", String(query.limit));
    if (query.cursor) params.set("cursor", query.cursor);
    const suffix = params.toString();
    return apiRequest<BookshelfPage>(`/api/v1/me/bookshelf${suffix ? `?${suffix}` : ""}`);
  },
};
