import { describe, expect, it } from "vitest";
import type { ArticleDraft } from "@/api/articles/articles.types";
import {
  buildDraftSavePayload,
  draftFieldsEqual,
  isDraftDirty,
  NEW_DRAFT_ROUTE_ID,
  toEditorDraftFields,
  VISIBILITY_OPTIONS,
  type EditorDraftFields,
} from "@/lib/article-editor-draft";

/*
 * Draft state is the part of Phase 1C-2 that must not drift, so it is pure and
 * tested directly: server->local mapping, the DIRTY definition, and the exact
 * save payload.
 */

function draft(overrides: Partial<ArticleDraft> = {}): ArticleDraft {
  return {
    articleId: "a1",
    title: "标题",
    summary: "摘要",
    coverUrl: null,
    bodyMode: "MARKDOWN",
    body: "正文",
    slug: null,
    visibility: "PRIVATE",
    categoryId: null,
    topicIds: [],
    lockVersion: 0,
    updatedAt: "2026-09-21T00:00:00Z",
    scheduledPublishAt: null,
    ...overrides,
  };
}

describe("toEditorDraftFields", () => {
  it("maps nulls to empty strings so inputs stay controlled", () => {
    const fields = toEditorDraftFields(
      draft({ title: null, summary: null, body: null, bodyMode: null }),
    );

    expect(fields.title).toBe("");
    expect(fields.summary).toBe("");
    expect(fields.body).toBe("");
    expect(fields.bodyMode).toBe("MARKDOWN");
  });

  it("keeps RICH_TEXT instead of coercing everything to Markdown", () => {
    expect(toEditorDraftFields(draft({ bodyMode: "RICH_TEXT" })).bodyMode).toBe("RICH_TEXT");
  });

  it("normalizes visibility and falls back to PRIVATE for unknown values", () => {
    expect(toEditorDraftFields(draft({ visibility: "public" })).visibility).toBe("PUBLIC");
    expect(toEditorDraftFields(draft({ visibility: "UNLISTED" })).visibility).toBe("UNLISTED");
    expect(toEditorDraftFields(draft({ visibility: "SECRET" })).visibility).toBe("PRIVATE");
  });

  it("copies topicIds instead of aliasing the server array", () => {
    const source = draft({ topicIds: ["t1"] });
    const fields = toEditorDraftFields(source);

    fields.topicIds.push("t2");
    expect(source.topicIds).toEqual(["t1"]);
  });
});

describe("isDraftDirty", () => {
  const base = toEditorDraftFields(draft({ body: "正文", topicIds: ["t1"] }));

  it("is clean right after load", () => {
    expect(isDraftDirty(base, base)).toBe(false);
  });

  it("becomes dirty when any field changes", () => {
    expect(isDraftDirty({ ...base, title: "改过" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, summary: "改过" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, body: "改过" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, bodyMode: "RICH_TEXT" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, visibility: "PUBLIC" }, base)).toBe(true);
    expect(isDraftDirty({ ...base, topicIds: ["t1", "t2"] }, base)).toBe(true);
  });

  it("returns to clean when the user edits a value back", () => {
    const edited: EditorDraftFields = { ...base, title: "临时" };
    expect(isDraftDirty(edited, base)).toBe(true);
    expect(isDraftDirty({ ...edited, title: base.title }, base)).toBe(false);
  });

  it("treats topic order as irrelevant", () => {
    const a: EditorDraftFields = { ...base, topicIds: ["t1", "t2"] };
    const b: EditorDraftFields = { ...base, topicIds: ["t2", "t1"] };

    expect(draftFieldsEqual(a, b)).toBe(true);
    expect(isDraftDirty(a, b)).toBe(false);
  });

  it("is never dirty before the draft has loaded", () => {
    expect(isDraftDirty(null, null)).toBe(false);
    expect(isDraftDirty(base, null)).toBe(false);
  });
});

describe("buildDraftSavePayload", () => {
  it("sends only the editable fields plus lockVersion", () => {
    const fields = toEditorDraftFields(
      draft({ title: "T", summary: "S", body: "B", bodyMode: "RICH_TEXT", visibility: "UNLISTED", topicIds: ["t1"] }),
    );

    expect(buildDraftSavePayload(fields, 7)).toEqual({
      title: "T",
      summary: "S",
      body: "B",
      bodyMode: "RICH_TEXT",
      visibility: "UNLISTED",
      topicIds: ["t1"],
      lockVersion: 7,
    });
  });

  it("never includes fields this round does not edit", () => {
    const payload = buildDraftSavePayload(toEditorDraftFields(draft()), 0);

    expect(Object.keys(payload).sort()).toEqual(
      ["body", "bodyMode", "lockVersion", "summary", "title", "topicIds", "visibility"].sort(),
    );
    expect(payload).not.toHaveProperty("coverUrl");
    expect(payload).not.toHaveProperty("categoryId");
    expect(payload).not.toHaveProperty("scheduledPublishAt");
    expect(payload).not.toHaveProperty("slug");
  });

  it("copies topicIds so later edits cannot mutate the payload", () => {
    const fields = toEditorDraftFields(draft({ topicIds: ["t1"] }));
    const payload = buildDraftSavePayload(fields, 0);

    fields.topicIds.push("t2");
    expect(payload.topicIds).toEqual(["t1"]);
  });
});

describe("constants", () => {
  it("uses Legacy's magic `new` route id", () => {
    expect(NEW_DRAFT_ROUTE_ID).toBe("new");
  });

  it("offers exactly the three backend visibility values", () => {
    expect(VISIBILITY_OPTIONS.map((option) => option.value)).toEqual([
      "PUBLIC",
      "UNLISTED",
      "PRIVATE",
    ]);
  });
});
