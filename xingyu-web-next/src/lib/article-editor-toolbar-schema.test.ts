import { describe, expect, it } from "vitest";
import {
  ARTICLE_EDITOR_TOOLBAR_SEGMENTS,
  getAllToolbarCapabilities,
  getToolbarMenuItems,
  TOOLBAR_BLOCK_TYPE_OPTIONS,
} from "@/lib/article-editor-toolbar-schema";

describe("ARTICLE_EDITOR_TOOLBAR_SEGMENTS", () => {
  it("exposes all formatting capabilities through grouped segments", () => {
    expect(getAllToolbarCapabilities().sort()).toEqual(
      [
        "bold",
        "code",
        "codeBlock",
        "clearInlineFormat",
        "hr",
        "imageUpload",
        "italic",
        "link",
        "ol",
        "redo",
        "strike",
        "taskList",
        "ul",
        "undo",
      ].sort(),
    );
  });

  it("uses compact block type options without code block or hr", () => {
    expect(TOOLBAR_BLOCK_TYPE_OPTIONS.map((option) => option.blockType)).toEqual([
      "paragraph",
      "h1",
      "h2",
      "h3",
      "h4",
      "quote",
    ]);
  });

  it("folds link into More on narrow layouts", () => {
    const more = ARTICLE_EDITOR_TOOLBAR_SEGMENTS.find(
      (segment) => segment.kind === "menu" && segment.id === "more",
    );
    expect(more && more.kind === "menu" ? getToolbarMenuItems(more, false) : []).toEqual([
      "clearInlineFormat",
      "code",
    ]);
    expect(more && more.kind === "menu" ? getToolbarMenuItems(more, true) : []).toEqual([
      "clearInlineFormat",
      "code",
      "link",
    ]);
  });

  it("keeps list and insert menus grouped", () => {
    const list = ARTICLE_EDITOR_TOOLBAR_SEGMENTS.find(
      (segment) => segment.kind === "menu" && segment.id === "list",
    );
    const insert = ARTICLE_EDITOR_TOOLBAR_SEGMENTS.find(
      (segment) => segment.kind === "menu" && segment.id === "insert",
    );

    expect(list && list.kind === "menu" ? list.items : []).toEqual(["ul", "ol", "taskList"]);
    expect(insert && insert.kind === "menu" ? insert.items : []).toEqual([
      "codeBlock",
      "hr",
      "imageUpload",
    ]);
  });
});
