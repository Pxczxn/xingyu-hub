/*
 * Authenticated collection CRUD + public/owner detail (Phase 2C, read-first).
 *
 * VERIFIED live 2026-09-24:
 *   list/create/rename/visibility/delete work
 *   GET /collections/{id} is 200 for PUBLIC (anyone) and owner PRIVATE/UNLISTED
 *   item add / bookmark stay HIDDEN — wrappers are not provided
 */
import { apiRequest } from "@/api/client";
import type {
  CollectionDetail,
  CollectionSummary,
  CreateCollectionPayload,
  UpdateCollectionPayload,
} from "./collections.types";

export const collectionsApi = {
  listMine: (): Promise<CollectionSummary[]> => apiRequest<CollectionSummary[]>("/api/v1/me/collections"),

  create: (payload: CreateCollectionPayload): Promise<CollectionSummary> =>
    apiRequest<CollectionSummary>("/api/v1/me/collections", { method: "POST", body: payload }),

  getById: (id: string): Promise<CollectionDetail> =>
    apiRequest<CollectionDetail>(`/api/v1/collections/${encodeURIComponent(id)}`),

  update: (id: string, payload: UpdateCollectionPayload): Promise<CollectionSummary> =>
    apiRequest<CollectionSummary>(`/api/v1/me/collections/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: payload,
    }),

  remove: (id: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/collections/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
