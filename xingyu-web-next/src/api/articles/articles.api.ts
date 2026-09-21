/*
 * Article domain API (extracted from the Legacy community API module — NOT the whole file).
 * Endpoint: GET /api/v1/articles/{articleId}
 */
import { apiRequest } from "@/api/client";
import type { ArticleDetail } from "./articles.types";

export const articlesApi = {
  getArticle: (articleId: string): Promise<ArticleDetail> =>
    apiRequest<ArticleDetail>(`/api/v1/articles/${encodeURIComponent(articleId)}`),
};
