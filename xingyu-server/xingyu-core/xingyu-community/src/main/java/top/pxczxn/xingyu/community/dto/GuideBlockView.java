package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * One block of a guide / rules document.
 *
 * Added 2026-10-03 with the structured-body work. The document used to arrive as
 * a single plain-text {@code body}, which is fine for READING but makes a table
 * of contents impossible: the client cannot know which line is a clause heading
 * without guessing, and guessing produces anchors that point at nothing.
 *
 * So the server splits the text into blocks and says which ones are headings. The
 * client renders the blocks and builds the outline from the heading ones.
 *
 * The author marks a heading explicitly with a leading {@code ## } (or
 * {@code ### } for a sub-clause). That is the point: this is a CONVENTION, not a
 * heuristic. Nothing here tries to infer "this line looks like a title" — an
 * author who wants a clause in the outline writes the marker, and an author who
 * does not gets an ordinary paragraph. Content without markers produces a single
 * paragraph block per blank-line-separated group and no outline, which is exactly
 * how the page behaved before this existed.
 */
@Value
@Builder
public class GuideBlockView {
    /** {@code "heading"} or {@code "paragraph"}. */
    String type;

    /** The text with any marker removed — ready to render, never raw. */
    String text;

    /**
     * Anchor id, present on headings only.
     *
     * Derived from the heading's position ({@code guide-heading-0}, …), not from
     * its text: two clauses can legitimately share a title, and ids must not
     * collide. Position is also stable for a given document revision, which is
     * all an in-page anchor needs.
     */
    String id;

    /** 2 or 3 for headings; 0 for paragraphs. */
    int level;
}
