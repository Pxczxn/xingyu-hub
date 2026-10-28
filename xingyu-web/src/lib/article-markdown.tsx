import { useMemo } from "react";
import type { Heading } from "mdast";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import {
  ARTICLE_HEADING_ID_PREFIX,
  parseArticleMarkdownAst,
  renderArticleMarkdown,
} from "@/lib/article-markdown-pipeline";
import { ArticleMarkdownMediaProvider } from "@/lib/article-markdown-media-context";
import { ArticleMarkdownLinkProvider } from "@/lib/article-markdown-link";

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

export function extractArticleOutline(
  body: string,
  headingIdPrefix = ARTICLE_HEADING_ID_PREFIX,
): ArticleOutlineItem[] {
  const tree = parseArticleMarkdownAst(body);
  const items: ArticleOutlineItem[] = [];
  let headingIndex = 0;

  visit(tree, "heading", (node: Heading) => {
    const id = `${headingIdPrefix}${headingIndex}`;
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

export function ArticleMarkdownBody({
  body,
  authenticatePrivateMedia = false,
  headingIdPrefix = ARTICLE_HEADING_ID_PREFIX,
  linksDisabled = false,
}: {
  body: string;
  /** Distinct targets when several articles are rendered on the same page. */
  headingIdPrefix?: string;
  /** 仅编辑器草稿预览：私有图片走认证 fetch，阅读页必须保持 false。 */
  authenticatePrivateMedia?: boolean;
  /** 仅编辑器草稿预览：链接保留 href，但点击不导航，避免预览时离开编辑器。 */
  linksDisabled?: boolean;
}) {
  const content = useMemo(() => {
    if (!body.trim()) return null;
    return renderArticleMarkdown(body, headingIdPrefix);
  }, [body, headingIdPrefix]);

  if (!content) {
    return (
      <section>
        <p className="text-sm text-muted-foreground">正文内容暂未提供。</p>
      </section>
    );
  }

  return (
    <ArticleMarkdownMediaProvider authenticatePrivateMedia={authenticatePrivateMedia}>
      <ArticleMarkdownLinkProvider linksDisabled={linksDisabled}>
        <div className="article-body">{content}</div>
      </ArticleMarkdownLinkProvider>
    </ArticleMarkdownMediaProvider>
  );
}
