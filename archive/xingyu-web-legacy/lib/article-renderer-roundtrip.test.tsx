import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { applyMarkdownFormatAction } from "@/lib/article-editor-markdown-insert";
import { runMilkdownFormatAction } from "@/lib/milkdown-editor-commands";
import { ArticleMarkdownBody } from "@/lib/article-markdown";

const CREPE_FEATURES = {
  [CrepeFeature.Toolbar]: false,
  [CrepeFeature.TopBar]: false,
  [CrepeFeature.Table]: false,
  [CrepeFeature.Latex]: false,
  [CrepeFeature.AI]: false,
  [CrepeFeature.BlockEdit]: false,
};

const FULL_SAMPLE = `# 一级标题

## 二级标题

### 三级标题

#### 四级标题

这是**粗体**、*斜体*与~~删除线~~。

[示例链接](https://example.com)

> 引用段落保留结构。

行内 \`inline-code\` 与代码块：

\`\`\`
GET /api/v1/articles
\`\`\`

- 无序第一项
- 无序第二项

1. 有序第一项
2. 有序第二项

- [ ] 待办任务
- [x] 已完成任务

![示例图](https://example.com/demo.png)

---
`;

async function milkdownRoundTrip(source: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);

  const crepe = new Crepe({
    root,
    defaultValue: source,
    features: CREPE_FEATURES,
  });

  await crepe.create();
  const output = crepe.getMarkdown();
  await crepe.destroy();
  root.remove();

  return output;
}

async function milkdownEditRoundTrip(source: string, edit: (editor: Crepe["editor"]) => void) {
  const root = document.createElement("div");
  document.body.appendChild(root);

  const crepe = new Crepe({
    root,
    defaultValue: source,
    features: CREPE_FEATURES,
  });

  await crepe.create();
  edit(crepe.editor);
  const output = crepe.getMarkdown();
  await crepe.destroy();
  root.remove();

  return output;
}

function buildMarkdownFromInserts() {
  let value = "小节\n\n重点\n\n任务\n";

  value = applyMarkdownFormatAction(
    { value, selectionStart: 0, selectionEnd: 2 },
    "h4",
  )!.next;

  const strikeStart = value.indexOf("重点");
  value = applyMarkdownFormatAction(
    { value, selectionStart: strikeStart, selectionEnd: strikeStart + 2 },
    "strike",
  )!.next;

  const taskLineStart = value.indexOf("任务");
  value = applyMarkdownFormatAction(
    { value, selectionStart: taskLineStart, selectionEnd: taskLineStart + 2 },
    "taskList",
  )!.next;

  return applyMarkdownFormatAction(
    { value, selectionStart: value.length, selectionEnd: value.length },
    "hr",
  )!.next;
}

function renderArticleBody(markdown: string) {
  const { container } = render(
    <div className="xy-article-body">
      <ArticleMarkdownBody body={markdown} />
    </div>,
  );
  return container.querySelector(".xy-article-body") as HTMLElement;
}

describe("ArticleMarkdownBody remark renderer", () => {
  it("maps markdown heading levels to h1-h4 elements", () => {
    const root = renderArticleBody("# H1\n\n## H2\n\n### H3\n\n#### H4");
    expect(root.querySelector("h1")?.textContent).toContain("H1");
    expect(root.querySelector("h2")?.textContent).toContain("H2");
    expect(root.querySelector("h3")?.textContent).toContain("H3");
    expect(root.querySelector("h4")?.textContent).toContain("H4");
  });
});

describe("Markdown → Milkdown → ArticleMarkdownBody", () => {
  it("preserves supported semantics after milkdown round-trip", async () => {
    const markdown = await milkdownRoundTrip(FULL_SAMPLE);
    const root = renderArticleBody(markdown);

    expect(root.querySelector("h1")).toBeTruthy();
    expect(root.querySelector("h2")).toBeTruthy();
    expect(root.querySelector("h3")).toBeTruthy();
    expect(root.querySelector("h4")).toBeTruthy();
    expect(root.querySelector("strong")).toBeTruthy();
    expect(root.querySelector("em")).toBeTruthy();
    expect(root.querySelector("del")).toBeTruthy();
    expect(root.querySelector('a[href="https://example.com"]')).toBeTruthy();
    expect(root.querySelector("blockquote")).toBeTruthy();
    expect(root.querySelector("p code")).toBeTruthy();
    expect(root.querySelector("pre code")).toBeTruthy();
    expect(root.querySelector("ul:not(.contains-task-list)")).toBeTruthy();
    expect(root.querySelector("ol")).toBeTruthy();
    expect(
      root.querySelector("ul.contains-task-list, li.task-list-item"),
    ).toBeTruthy();
    expect(root.querySelector('img[src="https://example.com/demo.png"]')).toBeTruthy();
    expect(root.querySelector("hr")).toBeTruthy();
  });
});

describe("Markdown insert → Milkdown edit → ArticleMarkdownBody", () => {
  it("keeps semantics after rich-text heading edit on markdown-inserted body", async () => {
    const inserted = buildMarkdownFromInserts();
    expect(inserted).toContain("#### 小节");
    expect(inserted).toContain("~~重点~~");
    expect(inserted).toContain("- [ ] 任务");
    expect(inserted).toContain("---");

    const markdown = await milkdownEditRoundTrip(inserted, (editor) => {
      runMilkdownFormatAction(editor, "h3");
    });
    const root = renderArticleBody(markdown);

    expect(root.querySelector("h3")?.textContent).toContain("小节");
    expect(root.querySelector("h4")).toBeFalsy();
    expect(root.querySelector("del")).toBeTruthy();
    expect(root.querySelector("ul.contains-task-list, li.task-list-item")).toBeTruthy();
    expect(root.querySelector("hr")).toBeTruthy();
  });
});
