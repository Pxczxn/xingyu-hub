import { describe, expect, it } from "vitest";
import { applyMarkdownFormatAction } from "@/lib/article-editor-markdown-insert";

function insert(
  value: string,
  start: number,
  end: number,
  action: Parameters<typeof applyMarkdownFormatAction>[1],
) {
  const result = applyMarkdownFormatAction(
    { value, selectionStart: start, selectionEnd: end },
    action,
  );
  expect(result).not.toBeNull();
  return result!;
}

describe("applyMarkdownFormatAction", () => {
  it("inserts H4 heading prefix", () => {
    const { next } = insert("小节标题\n", 0, 4, "h4");
    expect(next).toBe("#### 小节标题\n");
  });

  it("wraps selection with strike markers", () => {
    const { next } = insert("删除这段", 0, 4, "strike");
    expect(next).toBe("~~删除这段~~");
  });

  it("inserts fenced code block", () => {
    const { next } = insert("console.log(1)", 0, 14, "codeBlock");
    expect(next).toBe("\n```\nconsole.log(1)\n```\n");
  });

  it("prefixes task list items", () => {
    const { next } = insert("待办一\n待办二", 0, 7, "taskList");
    expect(next).toBe("- [ ] 待办一\n- [ ] 待办二");
  });

  it("inserts horizontal rule", () => {
    const { next } = insert("上文", 2, 2, "hr");
    expect(next).toBe("上文\n\n---\n\n");
  });

  it("converts heading lines to paragraph", () => {
    const { next } = insert("## 小节标题\n", 0, 9, "paragraph");
    expect(next).toBe("小节标题\n");
  });

  it("clears inline markdown from selection", () => {
    const { next } = insert("**加粗**", 0, 6, "clearInlineFormat");
    expect(next).toBe("加粗");
  });
});
