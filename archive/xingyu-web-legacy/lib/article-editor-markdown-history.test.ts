import { describe, expect, it } from "vitest";
import { MarkdownFormatHistory } from "@/lib/article-editor-markdown-history";

describe("MarkdownFormatHistory", () => {
  it("undoes and redoes programmatic edits", () => {
    const history = new MarkdownFormatHistory();
    const initial = { value: "a", selectionStart: 1, selectionEnd: 1 };
    const formatted = { value: "**a**", selectionStart: 3, selectionEnd: 3 };

    history.recordBefore(initial);
    expect(history.canUndo()).toBe(true);
    expect(history.canRedo()).toBe(false);

    const undone = history.undo(formatted);
    expect(undone).toEqual(initial);
    expect(history.canRedo()).toBe(true);

    const redone = history.redo(initial);
    expect(redone).toEqual(formatted);
  });
});
