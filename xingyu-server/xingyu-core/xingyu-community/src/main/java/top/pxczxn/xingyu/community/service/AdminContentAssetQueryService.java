package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.common.contract.access.AccessPolicy;
import top.pxczxn.xingyu.common.contract.access.AccessorContext;
import top.pxczxn.xingyu.common.contract.access.ResourceAccess;
import top.pxczxn.xingyu.common.contract.access.Visibility;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminContentAssetQueryService {

    private final SeriesMapper seriesMapper;
    private final SeriesChapterMapper seriesChapterMapper;
    private final ArticleMapper articleMapper;
    private final WorkingDraftMapper workingDraftMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final MomentMapper momentMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final CommunityProfileMapper profileMapper;
    private final CommunityUserMapper userMapper;

    public Map<String, Object> list(String type, String keyword, String status, int page, int pageSize) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, Math.min(pageSize, 100));
        String normalizedStatus = blankToNull(status == null ? null : status.trim().toUpperCase(Locale.ROOT));
        String needle = blankToNull(keyword == null ? null : keyword.trim());
        if ("SERIES".equalsIgnoreCase(type)) {
            IPage<Series> result = seriesMapper.pageForAdmin(new Page<>(safePage, safeSize), normalizedStatus, needle);
            return pageResult(toSeriesAssets(result.getRecords()), result.getTotal(), safePage, safeSize);
        }
        if ("ARTICLE".equalsIgnoreCase(type)) {
            IPage<Article> result = articleMapper.pageForAdmin(new Page<>(safePage, safeSize), normalizedStatus, needle);
            return pageResult(toArticleAssets(result.getRecords(), false), result.getTotal(), safePage, safeSize);
        }
        if ("MOMENT".equalsIgnoreCase(type)) {
            IPage<Moment> result = momentMapper.pageForAdmin(new Page<>(safePage, safeSize), normalizedStatus, needle);
            return pageResult(toMomentAssets(result.getRecords(), false), result.getTotal(), safePage, safeSize);
        }
        return null;
    }

    public Map<String, Object> detail(String id, String type) {
        if ("SERIES".equalsIgnoreCase(type)) {
            Series series = seriesMapper.selectById(id);
            if (series == null) {
                return null;
            }
            List<Map<String, Object>> rows = toSeriesAssets(List.of(series));
            return rows.isEmpty() ? null : rows.get(0);
        }
        if ("ARTICLE".equalsIgnoreCase(type)) {
            Article article = articleMapper.selectById(id);
            if (article == null) {
                return null;
            }
            List<Map<String, Object>> rows = toArticleAssets(List.of(article), true);
            return rows.isEmpty() ? null : rows.get(0);
        }
        if ("MOMENT".equalsIgnoreCase(type)) {
            Moment moment = momentMapper.selectById(id);
            if (moment == null) {
                return null;
            }
            List<Map<String, Object>> rows = toMomentAssets(List.of(moment), true);
            return rows.isEmpty() ? null : rows.get(0);
        }
        return null;
    }

    List<Map<String, Object>> toArticleAssets(List<Article> articles, boolean includeBody) {
        if (articles.isEmpty()) {
            return List.of();
        }
        List<String> articleIds = articles.stream().map(Article::getId).toList();
        Map<String, WorkingDraft> drafts = indexDrafts(articleIds);
        Map<String, PublishedRevision> published = indexPublished(articleIds);
        Map<String, FormalRevision> formals = indexFormals(published.values());
        AuthorBundle authors = loadAuthors(articles.stream().map(Article::getOwnerId).toList());
        List<Map<String, Object>> rows = new ArrayList<>(articles.size());
        for (Article article : articles) {
            WorkingDraft draft = drafts.get(article.getId());
            String title = draft == null ? null : draft.getTitle();
            Map<String, Object> value = asset(article.getId(), "ARTICLE", title, article.getStatus(), article.getUpdatedAt());
            value.put("lifecycleStatus", ArticleStateSupport.normalizeLifecycle(article.getLifecycleStatus()));
            value.put("moderationStatus", ArticleStateSupport.normalizeModeration(article.getModerationStatus()));
            PublishedRevision pointer = published.get(article.getId());
            FormalRevision formal = pointer == null || pointer.getFormalRevisionId() == null
                    ? null
                    : formals.get(pointer.getFormalRevisionId());
            boolean hasPublishedRevision = formal != null;
            value.put("hasPublishedRevision", hasPublishedRevision);
            value.put("visibility", hasPublishedRevision ? formal.getVisibility() : null);
            value.put("anonymousReadable", anonymousReadable(article, formal));
            if (draft != null) {
                value.put("summary", draft.getSummary());
                value.put("slug", draft.getSlug());
                if (includeBody) {
                    value.put("body", draft.getBody());
                }
            }
            applyAuthor(value, article.getOwnerId(), authors);
            rows.add(value);
        }
        return rows;
    }

    List<Map<String, Object>> toSeriesAssets(List<Series> seriesList) {
        if (seriesList.isEmpty()) {
            return List.of();
        }
        List<String> seriesIds = seriesList.stream().map(Series::getId).toList();
        Map<String, Long> chapterCounts = indexChapterCounts(seriesIds);
        AuthorBundle authors = loadAuthors(seriesList.stream().map(Series::getOwnerId).toList());
        List<Map<String, Object>> rows = new ArrayList<>(seriesList.size());
        for (Series series : seriesList) {
            Map<String, Object> value = asset(series.getId(), "SERIES", series.getTitle(), series.getStatus(), series.getUpdatedAt());
            value.put("summary", series.getDescription());
            value.put("slug", series.getSlug());
            value.put("chapterCount", chapterCounts.getOrDefault(series.getId(), 0L).intValue());
            applyAuthor(value, series.getOwnerId(), authors);
            rows.add(value);
        }
        return rows;
    }

    List<Map<String, Object>> toMomentAssets(List<Moment> moments, boolean includeBody) {
        if (moments.isEmpty()) {
            return List.of();
        }
        List<String> momentIds = moments.stream().map(Moment::getId).toList();
        Map<String, MomentRevision> revisions = indexLatestMoments(momentIds);
        AuthorBundle authors = loadAuthors(moments.stream().map(Moment::getAuthorId).toList());
        List<Map<String, Object>> rows = new ArrayList<>(moments.size());
        for (Moment moment : moments) {
            MomentRevision revision = revisions.get(moment.getId());
            String body = revision == null || revision.getBody() == null ? "" : revision.getBody();
            String preview = body.length() > 80 ? body.substring(0, 80) : body;
            Map<String, Object> value = asset(moment.getId(), "MOMENT", preview, moment.getStatus(), moment.getUpdatedAt());
            if (includeBody) {
                value.put("summary", body);
                value.put("body", body);
            }
            applyAuthor(value, moment.getAuthorId(), authors);
            rows.add(value);
        }
        return rows;
    }

    private Map<String, WorkingDraft> indexDrafts(List<String> articleIds) {
        Map<String, WorkingDraft> drafts = new HashMap<>();
        if (articleIds.isEmpty()) {
            return drafts;
        }
        for (WorkingDraft draft : workingDraftMapper.listByArticleIds(articleIds)) {
            drafts.putIfAbsent(draft.getArticleId(), draft);
        }
        return drafts;
    }

    private Map<String, PublishedRevision> indexPublished(List<String> articleIds) {
        Map<String, PublishedRevision> published = new HashMap<>();
        if (articleIds.isEmpty()) {
            return published;
        }
        for (PublishedRevision row : publishedRevisionMapper.listByArticleIds(articleIds)) {
            published.putIfAbsent(row.getArticleId(), row);
        }
        return published;
    }

    private Map<String, FormalRevision> indexFormals(Collection<PublishedRevision> published) {
        List<String> ids = published.stream()
                .map(PublishedRevision::getFormalRevisionId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, FormalRevision> formals = new HashMap<>();
        if (ids.isEmpty()) {
            return formals;
        }
        for (FormalRevision revision : formalRevisionMapper.listByIds(ids)) {
            formals.putIfAbsent(revision.getId(), revision);
        }
        return formals;
    }

    private Map<String, Long> indexChapterCounts(List<String> seriesIds) {
        Map<String, Long> counts = new HashMap<>();
        if (seriesIds.isEmpty()) {
            return counts;
        }
        for (ObjectCountRow row : seriesChapterMapper.countBySeriesIds(seriesIds)) {
            counts.put(row.getObjectId(), row.getCount());
        }
        return counts;
    }

    private Map<String, MomentRevision> indexLatestMoments(List<String> momentIds) {
        Map<String, MomentRevision> revisions = new HashMap<>();
        if (momentIds.isEmpty()) {
            return revisions;
        }
        for (MomentRevision revision : momentRevisionMapper.listLatestByMomentIds(momentIds)) {
            revisions.putIfAbsent(revision.getMomentId(), revision);
        }
        return revisions;
    }

    private AuthorBundle loadAuthors(List<String> ownerIds) {
        List<String> ids = ownerIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        Map<String, CommunityProfile> profiles = new HashMap<>();
        Map<String, CommunityUser> users = new HashMap<>();
        if (ids.isEmpty()) {
            return new AuthorBundle(profiles, users);
        }
        for (CommunityProfile profile : profileMapper.findByUserIds(ids)) {
            profiles.putIfAbsent(profile.getUserId(), profile);
        }
        for (CommunityUser user : userMapper.selectBatchIds(ids)) {
            users.putIfAbsent(user.getId(), user);
        }
        return new AuthorBundle(profiles, users);
    }

    private static void applyAuthor(Map<String, Object> value, String ownerId, AuthorBundle authors) {
        if (ownerId == null || ownerId.isBlank()) {
            return;
        }
        value.put("authorId", ownerId);
        CommunityProfile profile = authors.profiles.get(ownerId);
        CommunityUser user = authors.users.get(ownerId);
        String displayName = profile == null ? null : profile.getDisplayName();
        String username = profile == null ? null : profile.getUsername();
        value.put("authorDisplayName", displayName);
        value.put("authorUsername", username);
        value.put("authorLabel", formatAuthorLabel(displayName, username));
        value.put("authorName", value.get("authorLabel"));
        if (user != null) {
            value.put("authorEmail", user.getEmail());
        }
        if (profile != null) {
            value.put("authorBio", profile.getBio());
        }
    }

    static String formatAuthorLabel(String displayName, String username) {
        String nickname = displayName == null ? null : displayName.trim();
        String handle = username == null ? null : username.trim();
        if (nickname != null && !nickname.isEmpty() && handle != null && !handle.isEmpty()) {
            return nickname + " | " + handle;
        }
        if (nickname != null && !nickname.isEmpty()) {
            return nickname + " | " + nickname;
        }
        if (handle != null && !handle.isEmpty()) {
            return handle + " | " + handle;
        }
        return null;
    }

    static boolean anonymousReadable(Article article, FormalRevision formal) {
        if (article == null || !ArticleStateSupport.isActiveLifecycle(article)) {
            return false;
        }
        if (ArticleStateSupport.MODERATION_HIDDEN.equals(
                ArticleStateSupport.normalizeModeration(article.getModerationStatus()))) {
            return false;
        }
        if (formal == null || formal.getVisibility() == null) {
            return false;
        }
        try {
            Visibility visibility = Visibility.valueOf(formal.getVisibility());
            var decision = AccessPolicy.evaluate(
                    ResourceAccess.builder()
                            .exists(true)
                            .ownerId(ObjectId.of(article.getOwnerId()))
                            .visibility(visibility)
                            .ownerActive(true)
                            .resourceActive(true)
                            .underReview(false)
                            .build(),
                    AccessorContext.anonymous());
            return decision.isAllowed();
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static Map<String, Object> pageResult(List<Map<String, Object>> records, long total, int page, int pageSize) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("records", records);
        value.put("total", total);
        value.put("page", page);
        value.put("pageSize", pageSize);
        return value;
    }

    private static Map<String, Object> asset(String id, String type, String title, String status, Object updatedAt) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", id);
        value.put("type", type);
        value.put("title", title);
        value.put("status", status);
        value.put("updatedAt", updatedAt);
        return value;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private record AuthorBundle(Map<String, CommunityProfile> profiles, Map<String, CommunityUser> users) {
    }
}
