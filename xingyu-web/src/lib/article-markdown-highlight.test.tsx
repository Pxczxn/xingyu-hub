import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ArticleMarkdownBody } from "@/lib/article-markdown";

const JAVASCRIPT_FENCE = `## 二级

\`\`\`javascript
// note
function greet(name) {
  const message = "Hello";
  return message;
}
\`\`\`
`;

describe("article markdown code highlight", () => {
  it("colors keywords, strings and comments inside a fenced block", () => {
    const { container } = render(<ArticleMarkdownBody body={JAVASCRIPT_FENCE} />);
    const code = container.querySelector("pre code");

    expect(code).toHaveClass("hljs");
    expect(code?.querySelector(".hljs-keyword")?.textContent).toBe("function");
    expect(code?.querySelector(".hljs-string")?.textContent).toContain("Hello");
    expect(code?.querySelector(".hljs-comment")?.textContent).toContain("note");
    expect(container.querySelector("#article-h-0")?.textContent).toBe("二级");
  });

  it("keeps an unregistered language as plain text and still renders headings", () => {
    const { container } = render(
      <ArticleMarkdownBody
        body={`## 仍有标题

\`\`\`not-a-language
plain
\`\`\``}
      />,
    );
    const code = container.querySelector("pre code");

    expect(code?.textContent).toContain("plain");
    expect(code?.querySelector("[class^='hljs-']")).toBeNull();
    expect(container.querySelector("#article-h-0")?.textContent).toBe("仍有标题");
  });

  it("pins the code well to the sunken surface over the highlight.js theme", () => {
    const css = readFileSync(resolve("src/styles/globals.css"), "utf8");

    expect(css).toContain("highlight.js/styles/github.css");
    expect(css).toContain("background-color: hsl(var(--surface-sunken)) !important");
    expect(css).toContain("background-color: transparent !important");
    expect(css).toContain("padding: 0 !important");
  });
});
