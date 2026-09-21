import type { ArticleBodyMode } from "@/lib/article-body-convert";

/*
 * DEVELOPMENT-ONLY initial document for the editor (Phase 1C-1).
 *
 * This round deliberately has NO draft backend:
 *   - no GET draft, no save, no autosave, no publish
 * Phase 1C-2 will replace this module with the real
 * `GET /api/v1/articles/{id}/draft` contract.
 *
 * Everything produced here is explicitly labelled as development data:
 * the title carries the 【开发态占位】 prefix and the page renders a dev banner,
 * so a running V2 can never be mistaken for "the backend is connected".
 */

export const EDITOR_DEV_FIXTURE_MARKER = "DEVELOPMENT_FIXTURE";

/** Route id that means "create a new article" (Legacy used the same magic id). */
export const NEW_ARTICLE_ID = "new";

export type EditorLocalDocument = {
  marker: typeof EDITOR_DEV_FIXTURE_MARKER;
  title: string;
  summary: string;
  body: string;
  bodyMode: ArticleBodyMode;
};

const DEV_BODY = `# 开发态示例标题

这是一份**开发态占位正文**，用于验证编辑器 UI 与本地编辑能力。它不代表任何后端数据。

## 支持的格式

- 加粗、斜体、~~删除线~~
- 行内 \`code\` 与代码块
- 有序 / 无序列表
- [链接](https://example.com)

> 引用段落。

### 三级小节

\`\`\`ts
const body: string = "always markdown";
\`\`\`

#### 四级细节

写几个标题，左侧大纲会自动同步。
`;

export function createEditorDevDocument(articleId: string): EditorLocalDocument {
  if (articleId === NEW_ARTICLE_ID) {
    return {
      marker: EDITOR_DEV_FIXTURE_MARKER,
      title: "",
      summary: "",
      body: "",
      bodyMode: "MARKDOWN",
    };
  }

  return {
    marker: EDITOR_DEV_FIXTURE_MARKER,
    title: `【开发态占位】${articleId}`,
    summary: "开发态占位摘要 — 本轮未接入草稿读取接口，刷新页面后内容会丢失。",
    body: DEV_BODY,
    bodyMode: "MARKDOWN",
  };
}
