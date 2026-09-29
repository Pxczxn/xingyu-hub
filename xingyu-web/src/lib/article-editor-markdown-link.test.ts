import { describe, expect, it } from "vitest";
import {
  applyMarkdownLink,
  readMarkdownLinkDraft,
  removeMarkdownLink,
} from "@/lib/article-editor-markdown-link";

function snapshot(value: string, start: number, end: number) {
  return { value, selectionStart: start, selectionEnd: end };
}

describe("readMarkdownLinkDraft", () => {
  it("prefills selected text and focuses url", () => {
    const draft = readMarkdownLinkDraft(snapshot("选中文字", 0, 4));
    expect(draft.text).toBe("选中文字");
    expect(draft.hasSelection).toBe(true);
    expect(draft.focusTarget).toBe("url");
  });

  it("uses selected url as default href", () => {
    const draft = readMarkdownLinkDraft(snapshot("example.com", 0, 11));
    expect(draft.url).toBe("https://example.com");
  });

  it("reads existing markdown link for editing", () => {
    const value = "访问 [星语官网](https://xingyu.test) 了解更多";
    const start = value.indexOf("[");
    const end = value.indexOf(")") + 1;
    const draft = readMarkdownLinkDraft(snapshot(value, start, end));
    expect(draft.isEditingLink).toBe(true);
    expect(draft.text).toBe("星语官网");
    expect(draft.url).toBe("https://xingyu.test");
  });
});

describe("applyMarkdownLink", () => {
  it("wraps selected text into markdown link", () => {
    const result = applyMarkdownLink(snapshot("点击这里", 0, 4), {
      text: "点击这里",
      url: "example.com",
    });
    expect(result?.next).toBe("[点击这里](https://example.com)");
  });

  it("inserts link at cursor when nothing is selected", () => {
    const result = applyMarkdownLink(snapshot("前文", 2, 2), {
      text: "链接文字",
      url: "/articles/demo",
    });
    expect(result?.next).toBe("前文[链接文字](/articles/demo)");
  });

  it("updates an existing markdown link", () => {
    const value = "[旧文字](https://old.test)";
    const result = applyMarkdownLink(snapshot(value, 1, 4), {
      text: "新文字",
      url: "https://new.test",
    });
    expect(result?.next).toBe("[新文字](https://new.test)");
  });
});

describe("removeMarkdownLink", () => {
  it("removes markdown link syntax and keeps display text", () => {
    const value = "前缀 [链接文字](https://example.com) 后缀";
    const start = value.indexOf("[");
    const end = value.indexOf(")") + 1;
    const result = removeMarkdownLink(snapshot(value, start, end));
    expect(result?.next).toBe("前缀 链接文字 后缀");
  });
});
