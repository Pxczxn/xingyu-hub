/*
 * Announcement bodies are plain text. A blank line (empty, or only spaces and
 * tabs) separates paragraphs. Several blank lines in a row are still one
 * break, so they cannot stack into a tall gap. A single newline stays inside
 * the paragraph, and spaces next to text stay in place.
 *
 * This does not trim a paragraph and does not interpret HTML.
 */

const PARAGRAPH_BREAK = /\n(?:[ \t]*\n)+/;

export function announcementParagraphs(body: string): string[] {
  const normalized = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split(PARAGRAPH_BREAK)
    .map((part) => part.replace(/^\n+|\n+$/g, ""))
    .filter((part) => part.trim().length > 0);
}
