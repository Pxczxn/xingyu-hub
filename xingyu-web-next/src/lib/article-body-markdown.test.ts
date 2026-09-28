import { describe, expect, it } from "vitest";
import {
  ensureCanonicalMarkdownBody,
  isHtmlPollutedBody,
  recoverHtmlBodyToMarkdown,
} from "@/lib/article-body-markdown";

/* Migrated from Legacy lib/article-body-markdown.test.ts (content compatibility). */
describe("article-body-markdown guard", () => {
  it("detects legacy HTML body pollution", () => {
    expect(isHtmlPollutedBody("<h1>标题</h1><p>正文</p>")).toBe(true);
    expect(isHtmlPollutedBody("# 标题\n\n正文")).toBe(false);
    expect(isHtmlPollutedBody("行内 `code` 与 **粗体**")).toBe(false);
  });

  it("recovers HTML body to markdown", () => {
    const markdown = recoverHtmlBodyToMarkdown(
      "<h1>一级标题</h1><p>这是<strong>粗体</strong>段落。</p><ol><li>第一项</li><li>第二项</li></ol>",
    );

    expect(markdown).toContain("# 一级标题");
    expect(markdown).toMatch(/\*\*粗体\*\*/);
    expect(markdown).toMatch(/1\.\s+第一项/);
    expect(markdown).toMatch(/2\.\s+第二项/);
  });

  it("leaves canonical markdown unchanged", () => {
    const source = "## 标题\n\n**粗体** 与 1. 列表";
    expect(ensureCanonicalMarkdownBody(source)).toBe(source);
  });
});
