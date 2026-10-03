package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class GuidePageView {
    String id;
    String slug;
    String title;
    String body;
    /**
     * The body split into renderable blocks (2026-10-03).
     *
     * {@link #body} is kept alongside it so a client that has not been updated
     * still renders the document. New clients should prefer this: it is what
     * makes a clause outline possible, because it says which blocks are headings
     * instead of leaving the client to guess.
     *
     * Never null; empty when the document has no body.
     */
    List<GuideBlockView> blocks;
    Instant publishedAt;
}
