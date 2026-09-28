import { describe, expect, it } from "vitest";
import {
  ARTICLE_HEADING_ID_PREFIX,
} from "@/lib/article-markdown-pipeline";
import {
  extractArticleOutline,
} from "@/lib/article-markdown";
import {
  extractEditorOutline,
} from "@/lib/article-editor-outline";

/*
 * Migrated from Legacy lib/article-markdown-outline.test.ts.
 * Same sample, same assertions, same two subjects.
 *
 * Only the import site of `extractEditorOutline` changed: Phase 1C-1 split the
 * editor-only scanner out of the reading module (lib/article-markdown.tsx) into
 * the editor core (lib/article-editor-outline.ts), so the reader no longer
 * carries editor concerns and there is still exactly ONE implementation.
 */

const OUTLINE_SAMPLE = `# 文章标题

## 二级章节

### 三级小节

#### 四级细节

正文段落。
`;

describe("extractEditorOutline", () => {
  it("recognizes H1-H4 headings with correct levels", () => {
    const items = extractEditorOutline(OUTLINE_SAMPLE);
    expect(items.map((item) => item.level)).toEqual([1, 2, 3, 4]);
    expect(items.map((item) => item.text)).toEqual([
      "文章标题",
      "二级章节",
      "三级小节",
      "四级细节",
    ]);
  });
});

describe("extractArticleOutline", () => {
  it("parses H2-H4 while skipping H1 for reader outline", () => {
    const items = extractArticleOutline(OUTLINE_SAMPLE);
    expect(items.map((item) => item.level)).toEqual([2, 3, 4]);
    expect(items.map((item) => item.text)).toEqual([
      "二级章节",
      "三级小节",
      "四级细节",
    ]);
  });

  it("keeps heading ids aligned with renderer article-h-* sequence", () => {
    const items = extractArticleOutline(OUTLINE_SAMPLE);
    expect(items.map((item) => item.id)).toEqual([
      `${ARTICLE_HEADING_ID_PREFIX}1`,
      `${ARTICLE_HEADING_ID_PREFIX}2`,
      `${ARTICLE_HEADING_ID_PREFIX}3`,
    ]);
  });
});
