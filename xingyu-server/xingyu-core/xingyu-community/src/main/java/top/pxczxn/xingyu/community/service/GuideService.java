package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.GuideBlockView;
import top.pxczxn.xingyu.community.dto.GuidePageView;
import top.pxczxn.xingyu.community.entity.GuidePage;
import top.pxczxn.xingyu.community.mapper.GuidePageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.support.TokenSupport;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class GuideService {

    private final GuidePageMapper guidePageMapper;

    public List<GuidePageView> listPublished(int limit) {
        if (limit <= 0) {
            limit = 50;
        }
        return guidePageMapper.listPublished(limit).stream().map(this::toView).toList();
    }

    public GuidePageView getBySlug(String slug) {
        GuidePage page = guidePageMapper.findPublishedBySlug(slug);
        if (page == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(page);
    }

    public List<GuidePage> listForAdmin() {
        return guidePageMapper.listAll();
    }

    @Transactional
    public GuidePage createForAdmin(Map<String, String> body) {
        Instant now = Instant.now();
        String slug = trimRequired(body.get("slug"), "slug");
        GuidePage page = new GuidePage();
        page.setId(TokenSupport.newId());
        page.setSlug(slug);
        page.setTitle(trimRequired(body.get("title"), "title"));
        page.setBody(body.getOrDefault("body", ""));
        page.setSortOrder(parseInt(body.get("sortOrder"), 0));
        page.setStatus(body.getOrDefault("status", "PUBLISHED").toUpperCase(Locale.ROOT));
        page.setPublishedAt(now);
        page.setCreatedAt(now);
        guidePageMapper.insert(page);
        return page;
    }

    @Transactional
    public GuidePage updateForAdmin(String pageId, Map<String, String> body) {
        GuidePage page = guidePageMapper.selectById(pageId);
        if (page == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (body.containsKey("title")) {
            page.setTitle(trimRequired(body.get("title"), "title"));
        }
        if (body.containsKey("body")) {
            page.setBody(body.get("body"));
        }
        if (body.containsKey("status")) {
            page.setStatus(body.get("status").toUpperCase(Locale.ROOT));
        }
        if (body.containsKey("sortOrder")) {
            page.setSortOrder(parseInt(body.get("sortOrder"), page.getSortOrder() == null ? 0 : page.getSortOrder()));
        }
        guidePageMapper.updateById(page);
        return page;
    }

    private GuidePageView toView(GuidePage page) {
        return GuidePageView.builder()
                .id(page.getId())
                .slug(page.getSlug())
                .title(page.getTitle())
                .body(page.getBody())
                .blocks(extractBlocks(page.getBody()))
                .publishedAt(page.getPublishedAt())
                .build();
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, field + " 不能为空");
        }
        return raw.trim();
    }

    private static int parseInt(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        return Integer.parseInt(raw.trim());
    }

    private static final String HEADING_2 = "## ";
    private static final String HEADING_3 = "### ";

    /**
     * Split a guide / rules body into renderable blocks.
     *
     * The author marks a clause heading with a leading {@code ## } (or
     * {@code ### } for a sub-clause). That is deliberate: this is a CONVENTION,
     * not a heuristic. Nothing here tries to decide that a line "looks like a
     * title" — an author who wants a clause in the outline writes the marker,
     * and one who does not gets an ordinary paragraph. Guessing would produce
     * anchors pointing at lines the author never meant as headings.
     *
     * A body with no markers yields paragraph blocks only and therefore no
     * outline — identical to how these pages behaved before blocks existed, so
     * existing content degrades rather than breaking.
     *
     * Headings are anchored by POSITION, not by text: two clauses may legitimately
     * share a title, and an in-page anchor only needs to be unique within the
     * document.
     */
    private static List<GuideBlockView> extractBlocks(String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }

        List<GuideBlockView> blocks = new ArrayList<>();
        StringBuilder paragraph = new StringBuilder();
        int headingIndex = 0;

        for (String rawLine : body.split("\r?\n", -1)) {
            String line = rawLine.strip();

            String headingText = null;
            int level = 0;
            if (line.startsWith(HEADING_3)) {
                headingText = line.substring(HEADING_3.length()).strip();
                level = 3;
            } else if (line.startsWith(HEADING_2)) {
                headingText = line.substring(HEADING_2.length()).strip();
                level = 2;
            }

            if (headingText != null && !headingText.isEmpty()) {
                flushParagraph(blocks, paragraph);
                blocks.add(GuideBlockView.builder()
                        .type("heading")
                        .text(headingText)
                        .id("guide-heading-" + headingIndex)
                        .level(level)
                        .build());
                headingIndex++;
            } else if (line.isEmpty()) {
                flushParagraph(blocks, paragraph);
            } else {
                if (paragraph.length() > 0) {
                    paragraph.append('\n');
                }
                paragraph.append(line);
            }
        }
        flushParagraph(blocks, paragraph);
        return blocks;
    }

    private static void flushParagraph(List<GuideBlockView> blocks, StringBuilder paragraph) {
        if (paragraph.length() == 0) {
            return;
        }
        blocks.add(GuideBlockView.builder()
                .type("paragraph")
                .text(paragraph.toString())
                .level(0)
                .build());
        paragraph.setLength(0);
    }
}
