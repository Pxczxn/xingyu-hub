/*
 * Creation-space category API (Phase 2N).
 *
 * Four endpoints under `@RequestMapping("/me/creation-space")`:
 *
 *   GET    /api/v1/me/creation-space/categories              -> list (owner)
 *   POST   /api/v1/me/creation-space/categories              -> create
 *   PATCH  /api/v1/me/creation-space/categories/{id}         -> update
 *   DELETE /api/v1/me/creation-space/categories/{id}         -> REMOVE the row
 *
 * All four require a session (probed 2026-09-28: every one returns 401 on a
 * guest). There is no public read.
 *
 * ⚠️ `update` is PATCH, not PUT — and the service only touches the keys actually
 * present in the body, so a partial payload is correct and omitting `name` will
 * not blank it. `lockVersion` is the exception: it is read directly out of the
 * body, and an absent value is treated as 0 (CreationSpaceCategoryService#update).
 * Always send it.
 *
 * ⚠️ There is no way to set `sortOrder`. `create` hardcodes 0 and `update`
 * ignores the field, so the ordering the API returns is the ordering you get.
 */
import { apiRequest } from "@/api/client";
import type {
  CreateCategoryPayload,
  CreationSpaceCategory,
  UpdateCategoryPayload,
} from "./creation-space.types";

export const creationSpaceApi = {
  listCategories: (): Promise<CreationSpaceCategory[]> =>
    apiRequest<CreationSpaceCategory[]>("/api/v1/me/creation-space/categories"),

  createCategory: (payload: CreateCategoryPayload): Promise<CreationSpaceCategory> =>
    apiRequest<CreationSpaceCategory>("/api/v1/me/creation-space/categories", {
      method: "POST",
      body: payload,
    }),

  updateCategory: (
    categoryId: string,
    payload: UpdateCategoryPayload,
  ): Promise<CreationSpaceCategory> =>
    apiRequest<CreationSpaceCategory>(
      `/api/v1/me/creation-space/categories/${encodeURIComponent(categoryId)}`,
      { method: "PATCH", body: payload },
    ),

  /** Really deletes. Archive instead if the intent is "hide but keep". */
  deleteCategory: (categoryId: string): Promise<void> =>
    apiRequest<void>(`/api/v1/me/creation-space/categories/${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
    }),
};
