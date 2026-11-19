package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
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
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
        page.setStatus(statusForCreate(body));
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
        LambdaUpdateWrapper<GuidePage> update = new LambdaUpdateWrapper<GuidePage>()
                .eq(GuidePage::getId, pageId);
        boolean hasUpdate = false;
        if (body.containsKey("title")) {
            String title = trimRequired(body.get("title"), "title");
            update.set(GuidePage::getTitle, title);
            page.setTitle(title);
            hasUpdate = true;
        }
        if (body.containsKey("body")) {
            String guideBody = body.get("body");
            if (guideBody != null) {
                update.set(GuidePage::getBody, guideBody);
                page.setBody(guideBody);
                hasUpdate = true;
            }
        }
        if (body.containsKey("status")) {
            String status = normalizeGuideStatus(body.get("status"));
            update.set(GuidePage::getStatus, status);
            page.setStatus(status);
            hasUpdate = true;
        }
        if (body.containsKey("sortOrder")) {
            int sortOrder = parseSubmittedSortOrder(body.get("sortOrder"));
            update.set(GuidePage::getSortOrder, sortOrder);
            page.setSortOrder(sortOrder);
            hasUpdate = true;
        }
        if (hasUpdate) {
            guidePageMapper.update(null, update);
        }
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

    private static final Set<String> GUIDE_STATUSES = Set.of("PUBLISHED", "DRAFT", "ARCHIVED");

    private static String statusForCreate(Map<String, String> body) {
        if (!body.containsKey("status")) {
            return "PUBLISHED";
        }
        return normalizeGuideStatus(body.get("status"));
    }

    private static String normalizeGuideStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("status", "指南状态无效");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        if (!GUIDE_STATUSES.contains(normalized)) {
            throw new FieldContractException("status", "指南状态无效");
        }
        return normalized;
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, field + " 不能为空");
        }
        return raw.trim();
    }

    private static int parseSubmittedSortOrder(String raw) {
        if (raw == null || raw.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ex) {
            throw new FieldContractException("sortOrder", "排序无效");
        }
    }

    private static int parseInt(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        return Integer.parseInt(raw.trim());
    }

    private static final String HEADING_2 = "## ";
    private static final String HEADING_3 = "### ";
    private static final Pattern OPEN_FENCE = Pattern.compile("^( {0,3})(`{3,})([^`]*)\\s*$");
    private static final Pattern CLOSE_FENCE = Pattern.compile("^( {0,3})(`{3,})\\s*$");
    private static final Pattern QUOTE_LINE = Pattern.compile("^( {0,3})>( ?)?(.*)$");

    /**
     * Split a guide / rules body into renderable blocks.
     *
     * Headings remain a CONVENTION ({@code ## } / {@code ### }), not a heuristic.
     * Fenced code ({@code ```} / {@code ```lang}) and Markdown {@code >} quotes
     * are first-class blocks so blank lines inside a fence are not paragraph
     * breaks and indent is not {@code strip()}'d away. List lines stay
     * paragraphs with their leading whitespace, so the client can nest them.
     */
    // Package-private, not private, so the parser can be unit-tested directly.
    static List<GuideBlockView> extractBlocks(String body) {
        if (body == null || body.isBlank()) {
            return List.of();
        }

        List<GuideBlockView> blocks = new ArrayList<>();
        StringBuilder paragraph = new StringBuilder();
        StringBuilder quote = new StringBuilder();
        List<String> fenceLines = new ArrayList<>();
        String fenceLang = null;
        int fenceTicks = 0;
        int headingIndex = 0;
        boolean inFence = false;

        for (String rawLine : body.split("\r?\n", -1)) {
            if (inFence) {
                Matcher close = CLOSE_FENCE.matcher(rawLine);
                if (close.matches() && close.group(2).length() >= fenceTicks) {
                    blocks.add(GuideBlockView.builder()
                            .type("code")
                            .text(String.join("\n", fenceLines))
                            .level(0)
                            .lang(fenceLang)
                            .build());
                    fenceLines.clear();
                    fenceLang = null;
                    fenceTicks = 0;
                    inFence = false;
                } else {
                    fenceLines.add(rawLine);
                }
                continue;
            }

            Matcher open = OPEN_FENCE.matcher(rawLine);
            if (open.matches()) {
                flushParagraph(blocks, paragraph);
                flushQuote(blocks, quote);
                inFence = true;
                fenceTicks = open.group(2).length();
                fenceLang = fenceLanguage(open.group(3));
                continue;
            }

            String stripped = rawLine.strip();
            HeadingMatch heading = headingMatch(stripped);
            if (heading != null) {
                flushParagraph(blocks, paragraph);
                flushQuote(blocks, quote);
                blocks.add(GuideBlockView.builder()
                        .type("heading")
                        .text(heading.text())
                        .id("guide-heading-" + headingIndex)
                        .level(heading.level())
                        .build());
                headingIndex++;
                continue;
            }

            Matcher quoted = QUOTE_LINE.matcher(rawLine);
            if (quoted.matches()) {
                flushParagraph(blocks, paragraph);
                if (quote.length() > 0) {
                    quote.append('\n');
                }
                quote.append(quoted.group(3));
                continue;
            }

            if (stripped.isEmpty()) {
                flushParagraph(blocks, paragraph);
                flushQuote(blocks, quote);
                continue;
            }

            flushQuote(blocks, quote);
            if (paragraph.length() > 0) {
                paragraph.append('\n');
            }
            paragraph.append(rawLine);
        }
        if (inFence) {
            blocks.add(GuideBlockView.builder()
                    .type("code")
                    .text(String.join("\n", fenceLines))
                    .level(0)
                    .lang(fenceLang)
                    .build());
        }
        flushParagraph(blocks, paragraph);
        flushQuote(blocks, quote);
        return blocks;
    }

    private record HeadingMatch(String text, int level) {}

    private static HeadingMatch headingMatch(String stripped) {
        if (stripped.startsWith(HEADING_3)) {
            String text = stripped.substring(HEADING_3.length()).strip();
            if (!text.isEmpty()) {
                return new HeadingMatch(text, 3);
            }
        } else if (stripped.startsWith(HEADING_2)) {
            String text = stripped.substring(HEADING_2.length()).strip();
            if (!text.isEmpty()) {
                return new HeadingMatch(text, 2);
            }
        }
        return null;
    }

    private static String fenceLanguage(String info) {
        if (info == null) {
            return null;
        }
        String trimmed = info.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        int space = trimmed.indexOf(' ');
        return space < 0 ? trimmed : trimmed.substring(0, space);
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

    private static void flushQuote(List<GuideBlockView> blocks, StringBuilder quote) {
        if (quote.length() == 0) {
            return;
        }
        blocks.add(GuideBlockView.builder()
                .type("quote")
                .text(quote.toString())
                .level(0)
                .build());
        quote.setLength(0);
    }
}
