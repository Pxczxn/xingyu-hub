import type { EditorLinkDraft } from "@/lib/article-editor-body-controller";
import { isLikelyUrl, normalizeLinkUrl } from "@/lib/article-editor-link-url";
import type { MarkdownInsertResult, MarkdownSelection } from "@/lib/article-editor-markdown-insert";

const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

type MarkdownLinkMatch = {
  rangeStart: number;
  rangeEnd: number;
  text: string;
  url: string;
};

function findMarkdownLinkAt(
  value: string,
  selectionStart: number,
  selectionEnd: number,
): MarkdownLinkMatch | null {
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = MARKDOWN_LINK_PATTERN.exec(value);
  while (match) {
    const rangeStart = match.index;
    const rangeEnd = rangeStart + match[0].length;
    if (selectionStart <= rangeEnd && selectionEnd >= rangeStart) {
      return {
        rangeStart,
        rangeEnd,
        text: match[1],
        url: match[2],
      };
    }
    match = MARKDOWN_LINK_PATTERN.exec(value);
  }
  MARKDOWN_LINK_PATTERN.lastIndex = 0;
  return null;
}

export function readMarkdownLinkDraft(selection: MarkdownSelection): EditorLinkDraft {
  const { value, selectionStart, selectionEnd } = selection;
  const selected = value.slice(selectionStart, selectionEnd);
  const hasSelection = selectionStart !== selectionEnd;
  const existing = findMarkdownLinkAt(value, selectionStart, selectionEnd);

  if (existing) {
    return {
      text: existing.text,
      url: existing.url,
      hasSelection,
      isEditingLink: true,
      focusTarget: "url",
    };
  }

  const defaultUrl = hasSelection && isLikelyUrl(selected) ? normalizeLinkUrl(selected) : "";

  return {
    text: selected,
    url: defaultUrl,
    hasSelection,
    isEditingLink: false,
    focusTarget: hasSelection ? "url" : "text",
  };
}

function buildLinkSnippet(text: string, url: string) {
  return `[${text}](${url})`;
}

export function applyMarkdownLink(
  selection: MarkdownSelection,
  payload: { text: string; url: string },
): MarkdownInsertResult | null {
  const normalizedUrl = normalizeLinkUrl(payload.url);
  if (!normalizedUrl) return null;

  const { value, selectionStart, selectionEnd } = selection;
  const selected = value.slice(selectionStart, selectionEnd);
  const existing = findMarkdownLinkAt(value, selectionStart, selectionEnd);
  const displayText = payload.text.trim() || selected.trim() || normalizedUrl;
  const snippet = buildLinkSnippet(displayText, normalizedUrl);

  if (existing) {
    const next = value.slice(0, existing.rangeStart) + snippet + value.slice(existing.rangeEnd);
    return {
      next,
      cursorStart: existing.rangeStart,
      cursorEnd: existing.rangeStart + snippet.length,
    };
  }

  if (selectionStart !== selectionEnd) {
    const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
    return {
      next,
      cursorStart: selectionStart,
      cursorEnd: selectionStart + snippet.length,
    };
  }

  const next = value.slice(0, selectionStart) + snippet + value.slice(selectionEnd);
  const cursor = selectionStart + snippet.length;
  return { next, cursorStart: cursor, cursorEnd: cursor };
}

export function removeMarkdownLink(selection: MarkdownSelection): MarkdownInsertResult | null {
  const { value, selectionStart, selectionEnd } = selection;
  const existing = findMarkdownLinkAt(value, selectionStart, selectionEnd);
  if (!existing) return null;

  const next = value.slice(0, existing.rangeStart) + existing.text + value.slice(existing.rangeEnd);
  const cursorStart = existing.rangeStart;
  const cursorEnd = cursorStart + existing.text.length;
  return { next, cursorStart, cursorEnd };
}
