import {
  ensureCanonicalMarkdownBody,
  isHtmlPollutedBody,
  recoverHtmlBodyToMarkdown,
} from "@/lib/article-body-markdown";

export type PreparedArticleBody = {
  markdown: string;
  recoveredFromHtml: boolean;
};

/**
 * Prepare published article body for read rendering.
 * Turndown runs only when legacy HTML pollution is detected — not on normal Markdown.
 */
export function prepareArticleBodyForRead(body: string): PreparedArticleBody {
  const source = body ?? "";
  if (!isHtmlPollutedBody(source)) {
    return { markdown: source, recoveredFromHtml: false };
  }
  return {
    markdown: recoverHtmlBodyToMarkdown(source),
    recoveredFromHtml: true,
  };
}

/** Alias kept for editor/save paths that already use ensureCanonicalMarkdownBody. */
export { ensureCanonicalMarkdownBody, isHtmlPollutedBody };
