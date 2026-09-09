import type { EditorFormatAction } from "@/components/studio/article-editor-body-controller";

export type MarkdownInsertResult = {
  next: string;
  cursorStart: number;
  cursorEnd: number;
};

export type MarkdownSelection = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function wrapSelection(
  { value, selectionStart, selectionEnd }: MarkdownSelection,
  before: string,
  after = before,
): MarkdownInsertResult {
  const selected = value.slice(selectionStart, selectionEnd);
  const next =
    value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
  const cursorStart = selectionStart + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, cursorStart, cursorEnd };
}

export function prefixLines(
  { value, selectionStart, selectionEnd }: MarkdownSelection,
  prefix: string,
): MarkdownInsertResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const prefixed = block
    .split("\n")
    .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd);
  return { next, cursorStart: lineStart, cursorEnd: lineStart + prefixed.length };
}

export function prefixOrderedLines(
  { value, selectionStart, selectionEnd }: MarkdownSelection,
): MarkdownInsertResult {
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEnd = value.indexOf("\n", selectionEnd);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  const block = value.slice(lineStart, blockEnd);
  const prefixed = block
    .split("\n")
    .map((line, index) => {
      const stripped = line.replace(/^\d+\.\s+/, "");
      return `${index + 1}. ${stripped}`;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(blockEnd);
  return { next, cursorStart: lineStart, cursorEnd: lineStart + prefixed.length };
}

export function insertAtCursor(
  { value, selectionStart, selectionEnd }: MarkdownSelection,
  snippet: string,
): MarkdownInsertResult {
  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const cursor = selectionStart + snippet.length;
  return { next, cursorStart: cursor, cursorEnd: cursor };
}

export function applyMarkdownFormatAction(
  selection: MarkdownSelection,
  action: EditorFormatAction,
  options?: { linkUrl?: string },
): MarkdownInsertResult | null {
  const { value, selectionStart, selectionEnd } = selection;
  const selected = value.slice(selectionStart, selectionEnd);

  switch (action) {
    case "bold":
      return wrapSelection(selection, "**");
    case "italic":
      return wrapSelection(selection, "*");
    case "strike":
      return wrapSelection(selection, "~~");
    case "h1":
      return prefixLines(selection, "# ");
    case "h2":
      return prefixLines(selection, "## ");
    case "h3":
      return prefixLines(selection, "### ");
    case "h4":
      return prefixLines(selection, "#### ");
    case "quote":
      return prefixLines(selection, "> ");
    case "code":
      return wrapSelection(selection, "`");
    case "ul":
      return prefixLines(selection, "- ");
    case "ol":
      return prefixOrderedLines(selection);
    case "taskList":
      return prefixLines(selection, "- [ ] ");
    case "codeBlock": {
      const snippet = selected
        ? `\n\`\`\`\n${selected}\n\`\`\`\n`
        : "\n```\n\n```\n";
      return insertAtCursor(selection, snippet);
    }
    case "hr":
      return insertAtCursor(selection, "\n\n---\n\n");
    case "link": {
      const url = options?.linkUrl;
      if (!url) return null;
      if (selected) {
        const snippet = `[${selected}](${url})`;
        const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
        return {
          next,
          cursorStart: selectionStart,
          cursorEnd: selectionStart + snippet.length,
        };
      }
      return insertAtCursor(selection, `[链接文字](${url})`);
    }
    default:
      return null;
  }
}
