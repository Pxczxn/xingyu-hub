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
import { ArticleMarkdownImg } from "@/lib/article-markdown-media-context";

/*
 * Article Markdown READING pipeline — migrated from Legacy
 * lib/article-markdown-pipeline.tsx (same remark/rehype stack).
 *
 * This is the read pipeline ONLY. The Legacy editor (Milkdown / @milkdown/*)
 * is deliberately NOT migrated — reading markdown is not editing it.
 */

export const ARTICLE_HEADING_ID_PREFIX = "article-h-";

function rehypeArticleHeadingIds(options: { prefix?: string } = {}) {
  const prefix = options.prefix ?? ARTICLE_HEADING_ID_PREFIX;
  return (tree: HastRoot) => {
    let headingIndex = 0;
    visit(tree, "element", (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      node.properties = node.properties ?? {};
      node.properties.id = `${prefix}${headingIndex}`;
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
  img: ({ src, alt }) => <ArticleMarkdownImg src={src} alt={alt} />,
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

export function renderArticleMarkdown(body: string, headingIdPrefix = ARTICLE_HEADING_ID_PREFIX) {
  return articleMarkdownProcessor()
    .use(rehypeArticleHeadingIds, { prefix: headingIdPrefix })
    .processSync(body).result;
}
