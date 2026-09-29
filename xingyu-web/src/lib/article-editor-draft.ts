/*
 * Editor draft state — pure helpers (Phase 1C-2).
 *
 * No React, no fetching: this module is the single definition of
 *   - how a backend draft maps into local editor fields
 *   - when the editor counts as DIRTY (current fields vs the last clean snapshot)
 *   - what exactly goes into the PUT /draft body
 *
 * Keeping it pure is what makes "改回原值应恢复 clean" and "保存 payload 精确"
 * testable without mounting the page.
 */
import type {
  ArticleDraft,
  ArticleDraftSavePayload,
  ArticleVisibility,
} from "@/api/articles/articles.types";
import { normalizeBodyMode, type ArticleBodyMode } from "@/lib/article-body-convert";

/** Route id that means "create a new draft" (matches Legacy's magic `new` id). */
export const NEW_DRAFT_ROUTE_ID = "new";

export const VISIBILITY_OPTIONS: { value: ArticleVisibility; label: string }[] = [
  { value: "PUBLIC", label: "公开" },
  { value: "UNLISTED", label: "不收录" },
  { value: "PRIVATE", label: "私密" },
];

const VISIBILITY_VALUES = VISIBILITY_OPTIONS.map((option) => option.value);

function normalizeVisibility(value: string | null | undefined): ArticleVisibility {
  const upper = (value ?? "").toUpperCase();
  return (VISIBILITY_VALUES as string[]).includes(upper)
    ? (upper as ArticleVisibility)
    : "PRIVATE";
}

/** The editable surface of a draft. Everything here is a string / string[] (no nulls). */
export type EditorDraftFields = {
  title: string;
  summary: string;
  body: string;
  bodyMode: ArticleBodyMode;
  visibility: ArticleVisibility;
  topicIds: string[];
};

/** Backend draft -> local editor fields. `null` becomes `""` so inputs stay controlled. */
export function toEditorDraftFields(draft: ArticleDraft): EditorDraftFields {
  return {
    title: draft.title ?? "",
    summary: draft.summary ?? "",
    body: draft.body ?? "",
    bodyMode: normalizeBodyMode(draft.bodyMode),
    visibility: normalizeVisibility(draft.visibility),
    topicIds: [...(draft.topicIds ?? [])],
  };
}

/** Topic order is not meaningful, so compare it as a set. */
function sameTopicIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, index) => id === sortedB[index]);
}

export function draftFieldsEqual(a: EditorDraftFields, b: EditorDraftFields): boolean {
  return (
    a.title === b.title &&
    a.summary === b.summary &&
    a.body === b.body &&
    a.bodyMode === b.bodyMode &&
    a.visibility === b.visibility &&
    sameTopicIds(a.topicIds, b.topicIds)
  );
}

/**
 * DIRTY = current fields differ from the last clean snapshot (load or save).
 * Editing a field and typing it back to its original value is therefore clean
 * again — this is deliberately NOT a "has ever been touched" flag.
 */
export function isDraftDirty(
  current: EditorDraftFields | null,
  baseline: EditorDraftFields | null,
): boolean {
  if (!current || !baseline) return false;
  return !draftFieldsEqual(current, baseline);
}

/**
 * The exact save body. `lockVersion` comes from the last load/save; the backend
 * validates it and answers 409 on a mismatch.
 */
export function buildDraftSavePayload(
  fields: EditorDraftFields,
  lockVersion: number,
): ArticleDraftSavePayload {
  return {
    title: fields.title,
    summary: fields.summary,
    body: fields.body,
    bodyMode: fields.bodyMode,
    visibility: fields.visibility,
    topicIds: [...fields.topicIds],
    lockVersion,
  };
}

/**
 * Submit-time validation, mirrored 1:1 from the backend
 * (`ReviewService.validateDraftForSubmission`) so the frontend and backend agree
 * on both the rules and the wording.
 *
 * Deliberately NOT required, because the backend does not require them either:
 * summary, topics, category.
 */
export function validateForReview(fields: EditorDraftFields): string | null {
  if (!fields.title.trim()) return "提交审核前必须填写标题";
  if (!fields.bodyMode) return "提交审核前必须选择正文模式";
  if (!fields.body.trim()) return "提交审核前必须填写正文";
  if (!fields.visibility) return "提交审核前必须设置可见性";
  return null;
}
