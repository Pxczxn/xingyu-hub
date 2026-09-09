import TurndownService from "turndown";

/** Detect legacy rich-text HTML persisted into Article.body (not inline HTML in Markdown). */
export function isHtmlPollutedBody(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (!trimmed.includes("<")) return false;

  if (/^<(h[1-6]|p|div|ul|ol|blockquote|pre|table)\b/i.test(trimmed)) {
    return true;
  }

  return /<(h[1-6]|p|div|ul|ol|li|blockquote)\b[^>]*>[\s\S]*<\/\1>/i.test(trimmed);
}

let turndownService: TurndownService | null = null;

function getTurndownService() {
  if (!turndownService) {
    turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      emDelimiter: "*",
      strongDelimiter: "**",
    });
  }
  return turndownService;
}

/** One-time recovery for Article.body polluted by the old HTML editor. */
export function recoverHtmlBodyToMarkdown(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  return getTurndownService().turndown(trimmed).replace(/\r\n/g, "\n");
}

/** Article.body must always be canonical Markdown before load, edit, or save. */
export function ensureCanonicalMarkdownBody(body: string): string {
  if (!isHtmlPollutedBody(body)) return body;
  return recoverHtmlBodyToMarkdown(body);
}
