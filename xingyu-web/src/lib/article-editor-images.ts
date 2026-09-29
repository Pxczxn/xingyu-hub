/*
 * Editor-side Markdown image scanner.
 *
 * Migrated verbatim from Legacy lib/article-markdown.tsx (extractMarkdownImages)
 * and split out of the reading module for the same reason as
 * lib/article-editor-outline.ts: it powers the editor's inline image preview
 * strip only, and the reader must not carry editor concerns.
 */

export type MarkdownImageRef = {
  url: string;
  alt: string;
  lineIndex: number;
};

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
