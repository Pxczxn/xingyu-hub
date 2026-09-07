package top.pxczxn.xingyu.admin.controller.community;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import top.pxczxn.xingyu.common.result.Result;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** 管理端内容资产查询契约。按内容类型返回各自可运营字段，避免三类运营页展示同一套列与状态。 */
@RestController
@RequestMapping("/operations/content")
@RequiredArgsConstructor
public class AdminContentAssetController {
    private final SeriesMapper seriesMapper;
    private final SeriesChapterMapper seriesChapterMapper;
    private final ArticleMapper articleMapper;
    private final WorkingDraftMapper workingDraftMapper;
    private final MomentMapper momentMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final CommunityProfileMapper profileMapper;
    private final CommunityUserMapper userMapper;

    @GetMapping
    public Result<Map<String, Object>> list(@RequestParam String type,
                                             @RequestParam(required = false) String keyword,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "20") int pageSize) {
        List<Map<String, Object>> records;
        if ("SERIES".equalsIgnoreCase(type)) {
            var query = new LambdaQueryWrapper<Series>();
            if (status != null && !status.isBlank()) query.eq(Series::getStatus, status.trim().toUpperCase(Locale.ROOT));
            records = seriesMapper.selectList(query).stream()
                    .map(this::buildSeriesAsset)
                    .filter(v -> matchesKeyword(keyword, v.get("title"), v.get("summary")))
                    .toList();
        } else if ("ARTICLE".equalsIgnoreCase(type)) {
            var query = new LambdaQueryWrapper<Article>()
                    .eq(Article::getLifecycleStatus, ArticleStateSupport.LIFECYCLE_ACTIVE);
            if (status != null && !status.isBlank()) {
                query.eq(Article::getStatus, status.trim().toUpperCase(Locale.ROOT));
            }
            records = articleMapper.selectList(query).stream()
                    .map(this::buildArticleAsset)
                    .filter(v -> matchesKeyword(keyword, v.get("title")))
                    .toList();
        } else if ("MOMENT".equalsIgnoreCase(type)) {
            var query = new LambdaQueryWrapper<Moment>();
            if (status != null && !status.isBlank()) query.eq(Moment::getStatus, status.trim().toUpperCase(Locale.ROOT));
            records = momentMapper.selectList(query).stream()
                    .map(this::buildMomentAsset)
                    .filter(v -> matchesKeyword(keyword, v.get("title"), v.get("summary")))
                    .toList();
        } else {
            return Result.fail(422, "内容类型无效");
        }
        int safePage = Math.max(1, page), safeSize = Math.max(1, Math.min(pageSize, 100));
        int from = Math.min((safePage - 1) * safeSize, records.size());
        int to = Math.min(from + safeSize, records.size());
        return Result.ok(Map.of("records", records.subList(from, to), "total", records.size(), "page", safePage, "pageSize", safeSize));
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable String id, @RequestParam String type) {
        Map<String, Object> value = findAsset(id, type);
        if (value == null) {
            return Result.fail(404, "内容不存在");
        }
        return Result.ok(value);
    }

    @PatchMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String type = String.valueOf(body.getOrDefault("type", ""));
        String status = String.valueOf(body.getOrDefault("status", "")).toUpperCase(Locale.ROOT);
        if ("SERIES".equalsIgnoreCase(type) && ("ACTIVE".equals(status) || "ARCHIVED".equals(status))) {
            Series series = seriesMapper.selectById(id);
            if (series == null) return Result.fail("内容不存在");
            series.setStatus(status); seriesMapper.updateById(series);
        } else if ("ARTICLE".equalsIgnoreCase(type) && ("DRAFT".equals(status) || "IN_REVIEW".equals(status) || "PUBLISHED".equals(status))) {
            Article article = articleMapper.selectById(id);
            if (article == null) return Result.fail("内容不存在");
            article.setStatus(status); articleMapper.updateById(article);
        } else if ("MOMENT".equalsIgnoreCase(type) && ("PUBLISHED".equals(status) || "TRASHED".equals(status))) {
            Moment moment = momentMapper.selectById(id);
            if (moment == null) return Result.fail("内容不存在");
            moment.setStatus(status); momentMapper.updateById(moment);
        } else {
            return Result.fail(422, "内容类型或状态无效");
        }
        return Result.ok();
    }

    private Map<String, Object> findAsset(String id, String type) {
        if ("SERIES".equalsIgnoreCase(type)) {
            Series series = seriesMapper.selectById(id);
            return series == null ? null : buildSeriesAsset(series);
        }
        if ("ARTICLE".equalsIgnoreCase(type)) {
            Article article = articleMapper.selectById(id);
            return article == null ? null : buildArticleAsset(article);
        }
        if ("MOMENT".equalsIgnoreCase(type)) {
            Moment moment = momentMapper.selectById(id);
            return moment == null ? null : buildMomentAsset(moment);
        }
        return null;
    }

    private Map<String, Object> buildSeriesAsset(Series series) {
        Map<String, Object> value = asset(series.getId(), "SERIES", series.getTitle(), series.getStatus(), series.getUpdatedAt());
        value.put("summary", series.getDescription());
        value.put("slug", series.getSlug());
        value.put("chapterCount", seriesChapterMapper.listBySeriesId(series.getId()).size());
        applyAuthor(value, series.getOwnerId());
        return value;
    }

    private Map<String, Object> buildArticleAsset(Article article) {
        var draft = workingDraftMapper.findByArticleId(article.getId());
        String title = draft == null ? null : draft.getTitle();
        Map<String, Object> value = asset(article.getId(), "ARTICLE", title, article.getStatus(), article.getUpdatedAt());
        value.put("lifecycleStatus", ArticleStateSupport.normalizeLifecycle(article.getLifecycleStatus()));
        value.put("moderationStatus", ArticleStateSupport.normalizeModeration(article.getModerationStatus()));
        if (draft != null) {
            value.put("summary", draft.getSummary());
            value.put("body", draft.getBody());
            value.put("slug", draft.getSlug());
        }
        applyAuthor(value, article.getOwnerId());
        return value;
    }

    private Map<String, Object> buildMomentAsset(Moment moment) {
        var revision = momentRevisionMapper.findLatestByMomentId(moment.getId());
        String body = revision == null ? "" : revision.getBody();
        String preview = body.length() > 80 ? body.substring(0, 80) : body;
        Map<String, Object> value = asset(moment.getId(), "MOMENT", preview, moment.getStatus(), moment.getUpdatedAt());
        value.put("summary", body);
        value.put("body", body);
        applyAuthor(value, moment.getAuthorId());
        return value;
    }

    private void applyAuthor(Map<String, Object> value, String ownerId) {
        if (ownerId == null || ownerId.isBlank()) {
            return;
        }
        value.put("authorId", ownerId);
        CommunityProfile profile = profileMapper.findByUserId(ownerId);
        CommunityUser user = userMapper.selectById(ownerId);
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

    private static String formatAuthorLabel(String displayName, String username) {
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

    private static boolean matchesKeyword(String keyword, Object... fields) {
        if (keyword == null || keyword.isBlank()) return true;
        String needle = keyword.trim();
        for (Object field : fields) {
            if (field != null && String.valueOf(field).contains(needle)) return true;
        }
        return false;
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
}
