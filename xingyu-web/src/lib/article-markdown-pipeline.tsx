import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot } from "hast";
import type { Components } from "hast-util-to-jsx-runtime";
import rehypeReact from "rehype-react";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

/*
 * Article Markdown READING pipeline — migrated from Legacy
 * lib/article-markdown-pipeline.tsx (same remark/rehype stack).
 *
 * This is the read pipeline ONLY. The Legacy editor (Milkdown / @milkdown/*)
 * is deliberately NOT migrated — reading markdown is not editing it.
 */

export const ARTICLE_HEADING_ID_PREFIX = "article-h-";

function rehypeArticleHeadingIds() {
  return (tree: HastRoot) => {
    let headingIndex = 0;
    visit(tree, "element", (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      node.properties = node.properties ?? {};
      node.properties.id = `${ARTICLE_HEADING_ID_PREFIX}${headingIndex}`;
      headingIndex += 1;
    });
  };
}

export function parseArticleMarkdownAst(body: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(body) as MdastRoot;
}

const articleMarkdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  img: ({ src, alt }) => <img src={src} alt={alt ?? ""} loading="lazy" />,
};

const articleMarkdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeArticleHeadingIds)
  .use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: articleMarkdownComponents,
  });

export function renderArticleMarkdown(body: string) {
  return articleMarkdownProcessor.processSync(body).result;
}
