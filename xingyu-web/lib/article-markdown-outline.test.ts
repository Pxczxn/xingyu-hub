import { describe, expect, it } from "vitest";
import {
  ARTICLE_HEADING_ID_PREFIX,
} from "@/lib/article-markdown-pipeline";
import {
  extractArticleOutline,
  extractEditorOutline,
} from "@/lib/article-markdown";

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
