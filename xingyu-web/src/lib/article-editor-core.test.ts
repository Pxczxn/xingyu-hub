import { describe, expect, it } from "vitest";
import { extractEditorOutline } from "@/lib/article-editor-outline";
import { extractMarkdownImages } from "@/lib/article-editor-images";

/*
 * Editor-core pure helpers split out of the reading module in Phase 1C-1.
 * The outline half is covered by the migrated article-markdown-outline.test.ts;
 * this file covers the editor-only behaviours that test did not assert:
 * lineIndex (the outline is caret/scroll driven), inline-markdown stripping,
 * and the image scanner used by the editor's inline image strip.
 */

describe("extractEditorOutline", () => {
  it("reports the source line index of every heading", () => {
    const body = "开场白\n\n## 第一节\n\n正文\n\n### 第二节\n";
    const items = extractEditorOutline(body);

    expect(items.map((item) => item.lineIndex)).toEqual([2, 6]);
  });

  it("strips inline markdown from heading text", () => {
    const items = extractEditorOutline("## **粗体** 与 [链接](https://a.b) 与 `code`\n");

    expect(items[0].text).toBe("粗体 与 链接 与 code");
  });

  it("assigns a stable sequential id", () => {
    const items = extractEditorOutline("# 一\n\n## 二\n");

    expect(items.map((item) => item.id)).toEqual(["editor-h-0", "editor-h-1"]);
  });

  it("ignores headings deeper than H4 and non-heading lines", () => {
    const items = extractEditorOutline("# 一\n\n##### 五\n\n#不是标题\n");

    expect(items.map((item) => item.text)).toEqual(["一"]);
  });

  it("normalizes CRLF line endings", () => {
    const items = extractEditorOutline("# 一\r\n\r\n## 二\r\n");

    expect(items.map((item) => item.lineIndex)).toEqual([0, 2]);
  });
});

describe("extractMarkdownImages", () => {
  it("collects standalone image lines with url, alt and lineIndex", () => {
    const body = "段落\n\n![示意图](https://cdn.example.com/a.png)\n\n结尾\n";
    const images = extractMarkdownImages(body);

    expect(images).toEqual([
      { alt: "示意图", url: "https://cdn.example.com/a.png", lineIndex: 2 },
    ]);
  });

  it("ignores inline images embedded in a paragraph", () => {
    const images = extractMarkdownImages("文字 ![内联](https://a.b/c.png) 文字\n");

    expect(images).toEqual([]);
  });

  it("normalizes CRLF line endings", () => {
    const images = extractMarkdownImages("段落\r\n![图](https://a.b/c.png)\r\n");

    expect(images.map((image) => image.lineIndex)).toEqual([1]);
  });
});
