package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.GuidePageView;
import top.pxczxn.xingyu.community.entity.GuidePage;
import top.pxczxn.xingyu.community.mapper.GuidePageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.support.TokenSupport;

import java.time.Instant;
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
}
