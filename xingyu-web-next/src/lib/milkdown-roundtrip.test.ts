import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { describe, expect, it } from "vitest";
import { ensureCanonicalMarkdownBody } from "@/lib/article-body-markdown";

const SAMPLE = `# 一级标题

## 为什么从分层开始

新手最容易犯的错误，是**把所有逻辑**都堆在 Controller 里。

## 三个关键实践

1. **接口先行**：先定义 API 契约
2. **模块边界清晰**：按业务域拆分
3. **可观测性默认可用**：日志、指标、链路追踪

> 引用段落保留结构。

行内 \`code\` 与代码块：

\`\`\`
GET /api/v1/articles
\`\`\`

![示例图](https://example.com/demo.png)
`;

function normalizeMarkdown(markdown: string) {
  return markdown.replace(/\r\n/g, "\n").trim();
}

async function roundTrip(source: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);

  const crepe = new Crepe({
    root,
    defaultValue: source,
    features: {
      [CrepeFeature.Toolbar]: false,
      [CrepeFeature.TopBar]: false,
      [CrepeFeature.Table]: false,
      [CrepeFeature.Latex]: false,
      [CrepeFeature.AI]: false,
      [CrepeFeature.BlockEdit]: false,
    },
  });

  await crepe.create();
  const output = crepe.getMarkdown();
  await crepe.destroy();
  root.remove();

  return output;
}

describe("Milkdown markdown round-trip", () => {
  it("preserves headings, emphasis, lists, quote, code and image", async () => {
    const output = await roundTrip(SAMPLE);
    const normalized = normalizeMarkdown(output);

    expect(normalized).toContain("# 一级标题");
    expect(normalized).toContain("## 为什么从分层开始");
    expect(normalized).toContain("## 三个关键实践");
    expect(normalized).toMatch(/\*\*把所有逻辑\*\*/);
    expect(normalized).toMatch(/1\.\s+\*\*接口先行\*\*/);
    expect(normalized).toMatch(/2\.\s+\*\*模块边界清晰\*\*/);
    expect(normalized).toMatch(/3\.\s+\*\*可观测性默认可用\*\*/);
    expect(normalized).toMatch(/^>\s/m);
    expect(normalized).toContain("`code`");
    expect(normalized).toMatch(/```[\s\S]*GET \/api\/v1\/articles[\s\S]*```/);
    expect(normalized).toMatch(/!\[[^\]]*\]\(https:\/\/example\.com\/demo\.png\)/);
  });

  it("round-trips recovered legacy HTML through Milkdown as markdown", async () => {
    const recovered = ensureCanonicalMarkdownBody(
      "<h1>一级标题</h1><p>这是<strong>粗体</strong>段落。</p><ol><li>第一项</li><li>第二项</li></ol>",
    );
    const output = normalizeMarkdown(await roundTrip(recovered));

    expect(output).toContain("# 一级标题");
    expect(output).toMatch(/\*\*粗体\*\*/);
    expect(output).toMatch(/1\.\s+第一项/);
    expect(output).toMatch(/2\.\s+第二项/);
    expect(output).not.toMatch(/<h1\b/i);
    expect(output).not.toMatch(/<p\b/i);
  });

  it("does not downgrade headings or drop list items on second pass", async () => {
    const first = normalizeMarkdown(await roundTrip(SAMPLE));
    const second = normalizeMarkdown(await roundTrip(first));

    expect(second).toContain("## 为什么从分层开始");
    expect(second).toContain("## 三个关键实践");
    expect(second).toMatch(/1\.\s+\*\*接口先行\*\*/);
    expect(second).toMatch(/2\.\s+\*\*模块边界清晰\*\*/);
    expect(second).toMatch(/3\.\s+\*\*可观测性默认可用\*\*/);
    expect(second).not.toMatch(/^\*\*接口先行\*\*：/m);
  });
});
