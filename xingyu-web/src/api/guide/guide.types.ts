/*
 * Public guide-page DTO (GuidePageView).
 * Probe 2026-09-24: { id, slug, title, body, publishedAt }. No summary.
 * Extended 2026-10-03: + blocks (see below).
 */

/**
 * One block of a guide / rules document.
 *
 * Added with the server-side `blocks` field. The document used to arrive as a
 * single plain-text `body`, which reads fine but makes a clause outline
 * impossible: the client cannot know which line is a heading without guessing,
 * and guessing produces anchors pointing at nothing.
 *
 * The author marks a heading with a leading `## ` (`### ` for a sub-clause). That
 * is a convention, not a heuristic — see GuideService.extractBlocks.
 */
export type GuideBlock = {
  type: "heading" | "paragraph";
  /** Marker already stripped by the server; render verbatim. */
  text: string;
  /** Anchor id, headings only. */
  id?: string | null;
  /** 2 or 3 for headings, 0 for paragraphs. */
  level: number;
};

export type GuidePage = {
  id: string;
  slug: string;
  title: string;
  body: string;
  /**
   * Renderable blocks. Optional because it is additive: a backend that has not
   * shipped it yet omits the field, and the pages fall back to rendering `body`
   * as plain text — which is exactly how they behaved before.
   */
  blocks?: GuideBlock[] | null;
  publishedAt?: string;
};

/**
 * The outline of a document, from its heading blocks.
 *
 * Empty for a body written without markers, which is the honest answer: there is
 * no outline to show, and rendering an empty table of contents would be worse
 * than showing none.
 */
export function guideOutline(blocks: GuideBlock[] | null | undefined): GuideBlock[] {
  if (!blocks) return [];
  return blocks.filter((block) => block.type === "heading" && block.id);
}

export const COMMUNITY_RULES_SLUG = "community-rules";
