import { useMemo } from "react";
import type { Heading } from "mdast";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import {
  ARTICLE_HEADING_ID_PREFIX,
  parseArticleMarkdownAst,
  renderArticleMarkdown,
} from "@/lib/article-markdown-pipeline";

export type ArticleOutlineItem = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

export type EditorOutlineItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4;
  lineIndex: number;
};

export type MarkdownImageRef = {
  url: string;
  alt: string;
  lineIndex: number;
};

function stripInlineMarkdown(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

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

export function extractEditorOutline(body: string): EditorOutlineItem[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let headingIndex = 0;

  return lines.flatMap((line, lineIndex) => {
    const match = /^(#{1,4})\s+(.+)$/.exec(line.trim());
    if (!match) return [];
    return [{
      id: `editor-h-${headingIndex++}`,
      text: stripInlineMarkdown(match[2]),
      level: match[1].length as 1 | 2 | 3 | 4,
      lineIndex,
    }];
  });
}

export function extractMarkdownImages(body: string): MarkdownImageRef[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const images: MarkdownImageRef[] = [];

  lines.forEach((line, lineIndex) => {
    const match = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
    if (match) {
      images.push({ alt: match[1], url: match[2], lineIndex });
    }
  });

  return images;
}

export function ArticleMarkdownBody({ body }: { body: string }) {
  const content = useMemo(() => {
    if (!body.trim()) return null;
    return renderArticleMarkdown(body);
  }, [body]);

  if (!content) {
    return (
      <section>
        <p>正文内容暂未提供。</p>
      </section>
    );
  }

  return content;
}
