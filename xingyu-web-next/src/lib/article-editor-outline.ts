/*
 * Editor-side outline scanner.
 *
 * Migrated verbatim from Legacy lib/article-markdown.tsx — but SPLIT OUT of the
 * reading module. Phase 1B deliberately left extractEditorOutline behind because
 * it is not a reading concern; Phase 1C-1 needs it, so it now lives in the
 * editor core instead of being duplicated back into the reader.
 *
 * Reading side keeps `extractArticleOutline` (AST based, H2-H4, renderer-aligned
 * ids) in lib/article-markdown.tsx. The two implementations are intentionally
 * different and must not be merged:
 *   - reader: mdast/AST, used for the published article table of contents
 *   - editor: raw line scan, needs `lineIndex` to drive textarea/caret sync
 */

export type EditorOutlineItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3 | 4;
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
