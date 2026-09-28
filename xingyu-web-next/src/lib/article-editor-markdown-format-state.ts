import type { EditorBlockType, EditorFormatState } from "@/lib/milkdown-editor-format-state";
import { EMPTY_EDITOR_FORMAT_STATE } from "@/lib/milkdown-editor-format-state";
import type { MarkdownEditorSnapshot } from "@/lib/article-editor-markdown-history";

function getLineBounds(value: string, index: number) {
  const lineStart = value.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = value.indexOf("\n", index);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;
  return { lineStart, blockEnd };
}

function getCurrentLine(value: string, index: number) {
  const { lineStart, blockEnd } = getLineBounds(value, index);
  return value.slice(lineStart, blockEnd);
}

function readBlockType(line: string): EditorBlockType {
  if (/^```/.test(line)) return "codeBlock";
  if (/^---\s*$/.test(line)) return "hr";
  if (/^####\s/.test(line)) return "h4";
  if (/^###\s/.test(line)) return "h3";
  if (/^##\s/.test(line)) return "h2";
  if (/^#\s/.test(line)) return "h1";
  if (/^>\s/.test(line)) return "quote";
  return "paragraph";
}

function readListState(line: string) {
  if (/^-\s\[[ xX]\]\s/.test(line)) {
    return { ul: false, ol: false, taskList: true };
  }
  if (/^-\s/.test(line)) {
    return { ul: true, ol: false, taskList: false };
  }
  if (/^\d+\.\s/.test(line)) {
    return { ul: false, ol: true, taskList: false };
  }
  return { ul: false, ol: false, taskList: false };
}

function readInlineState(selected: string, value: string, start: number, end: number) {
  const text = selected || value.slice(start, end);
  const probe = text || getCurrentLine(value, start);

  const link = /\[([^\]]+)\]\([^)]+\)/.test(probe);
  const code = /`[^`]+`/.test(probe) || (selected.length > 0 && /^`.*`$/.test(selected));
  const strike = /~~[^~]+~~/.test(probe) || (selected.length > 0 && /^~~.*~~$/.test(selected));
  const bold =
    /\*\*[^*]+\*\*/.test(probe) || (selected.length > 0 && /^\*\*.*\*\*$/.test(selected));
  const italic =
    /(?:^|[^*])\*[^*]+\*(?:[^*]|$)/.test(probe) ||
    (selected.length > 0 && /^\*[^*]+\*$/.test(selected) && !/^\*\*/.test(selected));

  return { bold, italic, strike, code, link };
}

export function readMarkdownFormatState(
  snapshot: MarkdownEditorSnapshot,
  history?: { canUndo: () => boolean; canRedo: () => boolean },
): EditorFormatState {
  const { value, selectionStart, selectionEnd } = snapshot;
  const selected = value.slice(selectionStart, selectionEnd);
  const line = getCurrentLine(value, selectionStart);
  const listState = readListState(line);
  const inlineState = readInlineState(selected, value, selectionStart, selectionEnd);

  return {
    ...EMPTY_EDITOR_FORMAT_STATE,
    ...inlineState,
    ...listState,
    blockType: readBlockType(line),
    canUndo: history?.canUndo() ?? false,
    canRedo: history?.canRedo() ?? false,
  };
}
