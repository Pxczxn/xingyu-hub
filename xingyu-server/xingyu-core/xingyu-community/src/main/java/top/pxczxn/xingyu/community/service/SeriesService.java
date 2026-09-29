package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.SeriesChapterView;
import top.pxczxn.xingyu.community.dto.SeriesSummaryView;
import top.pxczxn.xingyu.community.dto.SeriesView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SeriesService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9-]{2,64}$");

    private final CreationSpaceService spaceService;
    private final SeriesMapper seriesMapper;
    private final SeriesChapterMapper chapterMapper;
    private final ArticleMapper articleMapper;
    private final SearchDocumentMapper searchDocumentMapper;

    public List<SeriesSummaryView> listForOwner(CommunityUser user) {
        return seriesMapper.listByOwnerId(user.getId()).stream()
                .map(this::toSummary)
                .toList();
    }

    public List<SeriesSummaryView> listPublic(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return seriesMapper.listActive(limit).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public SeriesView create(CommunityUser user, Map<String, Object> body) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        String title = requireTitle(body.get("title"));
        String slug = normalizeSlug(body.get("slug") == null ? title : body.get("slug"));
        validateSlug(slug);
        if (seriesMapper.findByOwnerIdAndSlug(user.getId(), slug) != null) {
            throw new FieldContractException("slug", "别名已被占用");
        }
        Instant now = Instant.now();
        Series series = new Series();
        series.setId(TokenSupport.newId());
        series.setOwnerId(user.getId());
        series.setSpaceId(space.getId());
        series.setTitle(title);
        series.setSlug(slug);
        series.setDescription(trimToNull(body.get("description")));
        series.setStatus("ACTIVE");
        series.setLockVersion(0L);
        series.setCreatedAt(now);
        series.setUpdatedAt(now);
        seriesMapper.insert(series);
        return toView(series, List.of());
    }

    public SeriesView getForOwner(CommunityUser user, String seriesId) {
        Series series = requireOwnedSeries(user, seriesId);
        return toView(series, chapterMapper.listBySeriesId(seriesId));
    }

    public SeriesView getPublic(String username, String slug) {
        Series series = seriesMapper.findPublicByUsernameAndSlug(username, slug);
        if (series == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(series, chapterMapper.listBySeriesId(series.getId()));
    }

    public SeriesView getPublicById(String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !"ACTIVE".equals(series.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toView(series, chapterMapper.listBySeriesId(series.getId()));
    }

    @Transactional
    public SeriesView update(CommunityUser user, String seriesId, Map<String, Object> body) {
        Series series = requireOwnedSeries(user, seriesId);
        long expected = body.get("lockVersion") instanceof Number n
                ? n.longValue()
                : series.getLockVersion() == null ? 0L : series.getLockVersion();
        if (series.getLockVersion() == null ? expected != 0L : series.getLockVersion() != expected) {
            throw new ContractException(ErrorCode.CONFLICT, "系列已被他人更新");
        }
        if (body.containsKey("title")) {
            series.setTitle(requireTitle(body.get("title")));
        }
        if (body.containsKey("description")) {
            series.setDescription(trimToNull(body.get("description")));
        }
        if (body.containsKey("status")) {
            String status = String.valueOf(body.get("status")).trim().toUpperCase(Locale.ROOT);
            if (!"ACTIVE".equals(status) && !"ARCHIVED".equals(status)) {
                throw new FieldContractException("status", "状态值无效");
            }
            series.setStatus(status);
        }
        series.setLockVersion(expected + 1);
        series.setUpdatedAt(Instant.now());
        seriesMapper.updateById(series);
        if (body.containsKey("chapterArticleIds")) {
            syncChapters(series, body.get("chapterArticleIds"));
        }
        return toView(series, chapterMapper.listBySeriesId(seriesId));
    }

    private void syncChapters(Series series, Object raw) {
        chapterMapper.deleteBySeriesId(series.getId());
        if (!(raw instanceof List<?> ids)) {
            return;
        }
        Instant now = Instant.now();
        int position = 1;
        for (Object rawId : ids) {
            if (rawId == null) {
                continue;
            }
            String articleId = String.valueOf(rawId).trim();
            if (articleId.isBlank()) {
                continue;
            }
            Article article = articleMapper.selectById(articleId);
            if (article == null || !series.getOwnerId().equals(article.getOwnerId())) {
                throw new FieldContractException("chapterArticleIds", "章节文章不存在或不属于当前用户");
            }
            SeriesChapter chapter = new SeriesChapter();
            chapter.setId(TokenSupport.newId());
            chapter.setSeriesId(series.getId());
            chapter.setArticleId(articleId);
            chapter.setPosition(position++);
            chapter.setCreatedAt(now);
            chapterMapper.insert(chapter);
        }
    }

    private Series requireOwnedSeries(CommunityUser user, String seriesId) {
        Series series = seriesMapper.selectById(seriesId);
        if (series == null || !user.getId().equals(series.getOwnerId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return series;
    }

    private SeriesSummaryView toSummary(Series series) {
        return SeriesSummaryView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .status(series.getStatus())
                .chapterCount((int) chapterMapper.countBySeriesId(series.getId()))
                .updatedAt(series.getUpdatedAt())
                .build();
    }

    private SeriesChapterView toChapterView(SeriesChapter chapter) {
        String title = null;
        var document = searchDocumentMapper.findByObject("ARTICLE", chapter.getArticleId());
        if (document != null) {
            title = document.getTitle();
        }
        return SeriesChapterView.builder()
                .id(chapter.getId())
                .articleId(chapter.getArticleId())
                .title(title)
                .position(chapter.getPosition() == null ? 0 : chapter.getPosition())
                .build();
    }

    private SeriesView toView(Series series, List<SeriesChapter> chapters) {
        return SeriesView.builder()
                .id(series.getId())
                .title(series.getTitle())
                .slug(series.getSlug())
                .description(series.getDescription())
                .status(series.getStatus())
                .lockVersion(series.getLockVersion() == null ? 0L : series.getLockVersion())
                .chapters(chapters.stream().map(this::toChapterView).toList())
                .updatedAt(series.getUpdatedAt())
                .build();
    }

    private static String requireTitle(Object raw) {
        String title = raw == null ? "" : String.valueOf(raw).trim();
        if (title.isBlank()) {
            throw new FieldContractException("title", "标题不能为空");
        }
        return title;
    }

    private static void validateSlug(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new FieldContractException("slug", "别名格式无效");
        }
    }

    private static String normalizeSlug(Object raw) {
        return String.valueOf(raw).trim().toLowerCase(Locale.ROOT).replace(' ', '-');
    }

    private static String trimToNull(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }
}
