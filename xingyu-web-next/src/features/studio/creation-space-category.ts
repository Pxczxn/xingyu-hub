/*
 * Pure helpers for the creation-space category manager (Phase 2N).
 *
 * Derived from `CreationSpaceCategoryService` so the client can reject what the
 * server would reject, BEFORE a round trip — and, where it cannot, say the same
 * thing the server would say.
 *
 * ⚠️ `deriveSlug` MIRRORS the server's `normalizeSlug`: trim → lowercase →
 * spaces to `-`. It does NOT strip anything else, so punctuation survives and
 * then fails `validateSlug`. That is deliberate: reproducing the server's
 * normalisation exactly means the user sees our validation message for the same
 * inputs the server would reject, instead of a confusing round-trip failure.
 *
 * ⚠️ Field errors arrive as `FieldContractException`, which the API layer
 * surfaces as a ProblemDetails whose `detail` is the FIELD MESSAGE ("别名已被占用")
 * — the field NAME is not in the payload we receive. So we cannot key errors by
 * field reliably; `describeCategoryError` returns the server's own sentence and
 * the caller shows it as a banner. Do not invent a per-field mapping.
 */
import { ApiError } from "@/api/client";
import {
  CATEGORY_ACTIVE,
  CATEGORY_ARCHIVED,
  CATEGORY_NAME_MAX_LENGTH,
  CATEGORY_SLUG_PATTERN,
} from "@/api/creation-space/creation-space.types";
import type { CreationSpaceCategory } from "@/api/creation-space/creation-space.types";

/** Mirrors `normalizeSlug`. */
export function deriveSlug(value: string): string {
  return value.trim().toLowerCase().replace(/ /g, "-");
}

export function validateName(name: string): string | null {
  if (!name.trim()) return "分类名称不能为空。";
  if (name.trim().length > CATEGORY_NAME_MAX_LENGTH) {
    return `分类名称不能超过 ${CATEGORY_NAME_MAX_LENGTH} 个字。`;
  }
  return null;
}

/**
 * Validates a slug the USER typed.
 *
 * Returns null when the slug is blank — blank is legal, because the server
 * derives one from the name.
 */
export function validateSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) return null;
  if (!CATEGORY_SLUG_PATTERN.test(trimmed)) {
    return "别名只能用 2–64 位小写字母、数字和连字符。";
  }
  return null;
}

/** The slug that will actually be submitted (typed value, else derived). */
export function effectiveSlug(name: string, typedSlug: string): string {
  const typed = typedSlug.trim();
  return typed ? typed.toLowerCase() : deriveSlug(name);
}

/** The slug's public URL fragment on the profile, for the preview line. */
export function categoryPathHint(username: string | null, slug: string): string {
  const handle = username?.trim();
  if (!handle) return `/works/${slug}`;
  return `/u/${handle}/works/${slug}`;
}

export function statusLabel(status: string): string {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === CATEGORY_ACTIVE) return "使用中";
  if (normalized === CATEGORY_ARCHIVED) return "已归档";
  // Unknown values are echoed rather than guessed at.
  return status || "未知状态";
}

/** Archived categories stay visible but are marked; they are not hidden. */
export function statusTone(status: string): "active" | "archived" | "unknown" {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === CATEGORY_ACTIVE) return "active";
  if (normalized === CATEGORY_ARCHIVED) return "archived";
  return "unknown";
}

/**
 * Puts ACTIVE first, then ARCHIVED, preserving the server's order within each
 * group. `sortOrder` is not writable over the API, so the server's ordering is
 * the only ordering there is — this only lifts archived rows out of the way.
 */
export function sortForDisplay(
  categories: readonly CreationSpaceCategory[],
): CreationSpaceCategory[] {
  const active: CreationSpaceCategory[] = [];
  const archived: CreationSpaceCategory[] = [];
  const rest: CreationSpaceCategory[] = [];
  for (const category of categories) {
    const tone = statusTone(category.status);
    if (tone === "active") active.push(category);
    else if (tone === "archived") archived.push(category);
    else rest.push(category);
  }
  return [...active, ...rest, ...archived];
}

export function countArchived(categories: readonly CreationSpaceCategory[]): number {
  return categories.filter((category) => statusTone(category.status) === "archived").length;
}

/** Trimmed payload field, or undefined when blank (server derives its own). */
export function optionalSlug(typedSlug: string): string | undefined {
  const trimmed = typedSlug.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * Turns an ApiError into a sentence to show the user.
 *
 * Keeps the server's own `detail` when it has one, because those messages are
 * already user-facing and more specific than anything generic we could write
 * ("别名已被占用" beats "保存失败"). Only falls back when there is nothing.
 */
export function describeCategoryError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const detail = error.problem.detail?.trim();
    if (detail) return detail;
    if (error.problem.status === 404) return "这条分类已不存在，请刷新后重试。";
    if (error.problem.status === 409) return "这条分类刚刚被改动过，请刷新后重试。";
    if (error.problem.status === 401) return "登录状态已过期，请重新登录。";
  }
  return fallback;
}

/**
 * Whether a failed update should make the caller re-read the list.
 *
 * 409 is the optimistic-lock rejection, and 404 means the row is gone. In both
 * cases the client's copy is stale and retrying the same payload would fail
 * again — so the UI must reload rather than offer "retry".
 */
export function shouldReloadAfterFailure(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.problem.status === 409 || error.problem.status === 404;
  }
  return false;
}
