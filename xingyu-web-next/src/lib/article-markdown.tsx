import { useMemo } from "react";
import type { Heading } from "mdast";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import {
  ARTICLE_HEADING_ID_PREFIX,
  parseArticleMarkdownAst,
  renderArticleMarkdown,
} from "@/lib/article-markdown-pipeline";

/*
 * Migrated from Legacy lib/article-markdown.tsx — READ path only.
 * The editor-only helpers (extractEditorOutline / extractMarkdownImages) are
 * intentionally NOT migrated: this round must not pull in editor concerns.
 */

export type ArticleOutlineItem = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

export function extractArticleOutline(body: string): ArticleOutlineItem[] {
  const tree = parseArticleMarkdownAst(body);
  const items: ArticleOutlineItem[] = [];
  let headingIndex = 0;

  visit(tree, "heading", (node: Heading) => {
    const id = `${ARTICLE_HEADING_ID_PREFIX}${headingIndex}`;
    headingIndex += 1;
    if (node.depth < 2 || node.depth > 4) return;
    items.push({
      id,
      text: toString(node).trim(),
      level: node.depth as 2 | 3 | 4,
    });
  });

  return items;
}

export function ArticleMarkdownBody({ body }: { body: string }) {
  const content = useMemo(() => {
    if (!body.trim()) return null;
    return renderArticleMarkdown(body);
  }, [body]);

  if (!content) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">正文内容暂未提供。</p>
      </section>
    );
  }

  return <div className="article-body">{content}</div>;
}
