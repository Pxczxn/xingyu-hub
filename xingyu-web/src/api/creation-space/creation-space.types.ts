/*
 * Creation-space category domain types (Phase 2N).
 *
 * Verified against `CommunityCreationSpaceController`
 * (`@RequestMapping("/me/creation-space")`) + `CreationSpaceCategoryService` +
 * `CategoryView` on 2026-09-28.
 *
 * ⚠️ THIS IS NOT A MIGRATION. Legacy never built a page for these endpoints —
 * `app/studio/categories/` exists as a DIRECTORY but has no `page.tsx`, and
 * Legacy's redirect table points `/studio/categories` at `/studio/settings`,
 * which is a 40-line static shell that links back to itself. So the backend CRUD
 * has been reachable-but-unreachable: fully implemented, never surfaced.
 *
 * Contract facts that shape the UI:
 *   - `slug` is the user-facing handle. Pattern `^[a-z0-9-]{2,64}$`, and an
 *     EMPTY slug is DERIVED from the name (lowercase, spaces → `-`).
 *   - `slug` collisions are a FIELD error: `FieldContractException("slug",
 *     "别名已被占用")`, not a generic conflict.
 *   - `name` blank → `FieldContractException("name", "分类名称不能为空")`.
 *   - `status` is `ACTIVE` | `ARCHIVED` only. "Delete" is NOT archival —
 *     `DELETE` really removes the row (`categoryMapper.deleteById`), while
 *     `update` can flip status to `ARCHIVED`. Two different operations.
 *   - `update` is optimistic-locked on `lockVersion`; a stale value yields
 *     `CONFLICT` (409) "分类已被他人更新". So the client MUST round-trip the
 *     version it read, and re-read after a 409 instead of retrying blindly.
 *   - `sortOrder` is READ-ONLY over the API: `create` hardcodes 0 and `update`
 *     ignores it. Do not offer a reorder control.
 */

/** `CategoryView`. */
export type CreationSpaceCategory = {
  id: string;
  name: string;
  slug: string;
  /** `ACTIVE` | `ARCHIVED`. The backend rejects anything else. */
  status: string;
  /** Optimistic-lock token. Must be echoed back on update. */
  lockVersion: number;
  /** Present but never writable through this API. */
  sortOrder: number;
};

export type CreateCategoryPayload = {
  name: string;
  /** Optional — the server derives it from `name` when blank. */
  slug?: string;
};

export type UpdateCategoryPayload = {
  /** REQUIRED: the version we read. Omitting it means "0" server-side. */
  lockVersion: number;
  name?: string;
  status?: "ACTIVE" | "ARCHIVED";
};

/** Slug rule mirrored from `CreationSpaceCategoryService.SLUG_PATTERN`. */
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9-]{2,64}$/;
export const CATEGORY_NAME_MAX_LENGTH = 64;

export const CATEGORY_ACTIVE = "ACTIVE";
export const CATEGORY_ARCHIVED = "ARCHIVED";

export function isArchived(category: Pick<CreationSpaceCategory, "status">): boolean {
  return (category.status ?? "").toUpperCase() === CATEGORY_ARCHIVED;
}
