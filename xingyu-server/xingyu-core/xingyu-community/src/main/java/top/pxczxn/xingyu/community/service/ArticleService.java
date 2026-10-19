package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.access.Visibility;
import top.pxczxn.xingyu.community.dto.ArticlePublicView;
import top.pxczxn.xingyu.community.dto.ArticleRevisionView;
import top.pxczxn.xingyu.community.dto.ArticleSummaryView;
import top.pxczxn.xingyu.community.dto.WorkingDraftView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.ArticleTopic;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CreationSpaceCategory;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CreationSpaceCategoryMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ArticleService {

    private final CreationSpaceService spaceService;
    private final ArticleMapper articleMapper;
    private final WorkingDraftMapper draftMapper;
    private final ArticleTopicMapper articleTopicMapper;
    private final CreationSpaceCategoryMapper categoryMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final ArticleAccessService articleAccessService;
    private final CommunityProfileMapper profileMapper;
    private final TopicMapper topicMapper;
    private final SeriesMapper seriesMapper;
    private final CommunityEventSupport eventSupport;

    public List<ArticleSummaryView> listForOwner(CommunityUser user) {
        return articleMapper.listByOwnerId(user.getId()).stream()
                .filter(ArticleStateSupport::isActiveLifecycle)
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public WorkingDraftView createShell(CommunityUser user) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        Instant now = Instant.now();

        Article article = new Article();
        article.setId(TokenSupport.newId());
        article.setSpaceId(space.getId());
        article.setOwnerId(user.getId());
        ArticleStateSupport.initNewArticle(article);
        article.setCreatedAt(now);
        article.setUpdatedAt(now);
        articleMapper.insert(article);

        WorkingDraft draft = new WorkingDraft();
        draft.setId(TokenSupport.newId());
        draft.setArticleId(article.getId());
        draft.setBodyMode("MARKDOWN");
        draft.setVisibility("PRIVATE");
        draft.setLockVersion(0L);
        draft.setCreatedAt(now);
        draft.setUpdatedAt(now);
        draftMapper.insert(draft);

        return toDraftView(article, draft, List.of());
    }

    public WorkingDraftView getDraft(CommunityUser user, String articleId) {
        Article article = requireOwnedArticle(user, articleId);
        WorkingDraft draft = requireDraft(articleId);
        return toDraftView(article, draft, listTopicIds(articleId));
    }

    public List<ArticleRevisionView> listRevisions(CommunityUser user, String articleId) {
        requireOwnedArticle(user, articleId);
        return formalRevisionMapper.listByArticleId(articleId).stream()
                .map(revision -> ArticleRevisionView.builder()
                        .id(revision.getId())
                        .revisionNumber(revision.getRevisionNumber() == null ? 0 : revision.getRevisionNumber())
                        .title(revision.getTitle())
                        .summary(revision.getSummary())
                        .visibility(revision.getVisibility())
                        .frozenAt(revision.getFrozenAt())
                        .build())
                .toList();
    }

    /**
     * 保存草稿（Studio Contract Recovery — Draft Integrity，2026-10-09 重写持久化方式）。
     *
     * <p>两个正确性修复，均以条件 UPDATE 实现：
     * <ol>
     *   <li><b>D0 乐观锁原子化</b>：WHERE 同时携带 {@code lock_version = expected}，
     *       检查-写入在同一条件 UPDATE 内原子完成。旧实现是「先读后写」两步——
     *       {@code updateById} 的 WHERE 只有 id，REPEATABLE READ 下两个客户端基于同一
     *       版本并发保存会双双通过校验、后写静默覆盖前者，且两次都写 expected+1，
     *       版本号不变，事后无法察觉。现在 affected=0 即并发冲突 → 409，本次写库整体未发生。</li>
     *   <li><b>D3 字段清空语义</b>：SET 子句只包含本次提交的键（显式 null = 用户主动清空），
     *       未提交的键不出现、绝不被触碰——不做全字段 ALWAYS 更新。
     *       旧实现 {@code updateById} 被 MyBatis-Plus 默认 NOT_NULL 策略吞掉 null，
     *       用户清空 summary/coverUrl/slug/body/title 静默失效，且响应（内存实体）
     *       与 DB 不一致。现在响应从 DB 重读构造，与持久化结果严格一致。</li>
     * </ol>
     */
    @Transactional
    public WorkingDraftView saveDraft(CommunityUser user, String articleId, Map<String, Object> body) {
        Article article = requireOwnedArticle(user, articleId);
        if (!ArticleStateSupport.canEditDraft(article)) {
            throw new ContractException(ErrorCode.CONFLICT, "文章当前不可编辑");
        }

        WorkingDraft draft = requireDraft(articleId);
        long expected = body.get("lockVersion") instanceof Number number
                ? number.longValue()
                : draft.getLockVersion() == null ? 0L : draft.getLockVersion();
        if (draft.getLockVersion() == null ? expected != 0L : draft.getLockVersion() != expected) {
            // 快速失败路径：真正的并发裁决在下面的条件 UPDATE
            throw new ContractException(ErrorCode.CONFLICT, "草稿已被他人更新，请刷新后重试");
        }

        Instant now = Instant.now();
        UpdateWrapper<WorkingDraft> draftUpdate = new UpdateWrapper<WorkingDraft>()
                .eq("article_id", articleId)
                .eq("lock_version", expected)
                .set("lock_version", expected + 1)
                .set("updated_at", now);
        if (body.containsKey("title")) {
            draftUpdate.set("title", trimToNull(body.get("title")));
        }
        if (body.containsKey("summary")) {
            draftUpdate.set("summary", trimToNull(body.get("summary")));
        }
        if (body.containsKey("coverUrl")) {
            draftUpdate.set("cover_url", trimToNull(body.get("coverUrl")));
        }
        if (body.containsKey("bodyMode")) {
            draftUpdate.set("body_mode", parseBodyMode(body.get("bodyMode")));
        }
        if (body.containsKey("body")) {
            draftUpdate.set("body", trimToNull(body.get("body")));
        }
        if (body.containsKey("slug")) {
            draftUpdate.set("slug", trimToNull(body.get("slug")));
        }
        if (body.containsKey("visibility")) {
            draftUpdate.set("visibility", parseVisibility(body.get("visibility")));
        }
        if (body.containsKey("scheduledPublishAt")) {
            draftUpdate.set("scheduled_publish_at", parseInstant(body.get("scheduledPublishAt")));
        }

        int updated = draftMapper.update(null, draftUpdate);
        if (updated == 0) {
            // 并发期间版本已被其他请求推进：本次保存整体未生效
            throw new ContractException(ErrorCode.CONFLICT, "草稿已被他人更新，请刷新后重试");
        }

        UpdateWrapper<Article> articleUpdate = new UpdateWrapper<Article>()
                .eq("id", articleId)
                .set("updated_at", now);
        if (body.containsKey("categoryId")) {
            String categoryId = trimToNull(body.get("categoryId"));
            if (categoryId != null) {
                requireOwnedCategory(article.getSpaceId(), categoryId);
            }
            // 显式 SET：清空分类（null）也必须真正落库
            articleUpdate.set("category_id", categoryId);
        }
        articleMapper.update(null, articleUpdate);

        if (body.containsKey("topicIds")) {
            syncTopics(articleId, body.get("topicIds"));
        }

        eventSupport.publishArticleEvent(
                "draft-changed:" + articleId + ":" + (expected + 1),
                CommunityEventSupport.DRAFT_CHANGED,
                articleId);

        // 响应必须反映真实持久化结果：从 DB 重读，而不是用内存实体
        Article freshArticle = articleMapper.selectById(articleId);
        WorkingDraft freshDraft = requireDraft(articleId);
        return toDraftView(freshArticle, freshDraft, listTopicIds(articleId));
    }

    @Transactional
    public WorkingDraftView schedulePublish(CommunityUser user, String articleId, Map<String, Object> body) {
        Instant scheduledAt = parseInstant(body.get("scheduledPublishAt"));
        if (scheduledAt == null || !scheduledAt.isAfter(Instant.now())) {
            throw new FieldContractException("scheduledPublishAt", "定时发布时间必须晚于当前时间");
        }
        Map<String, Object> patch = new java.util.HashMap<>();
        patch.put("scheduledPublishAt", scheduledAt.toString());
        if (body.containsKey("lockVersion")) {
            patch.put("lockVersion", body.get("lockVersion"));
        }
        return saveDraft(user, articleId, patch);
    }

    /**
     * 取消定时（D1 修复，2026-10-09）：显式 {@code SET scheduled_publish_at = NULL}。
     * 旧实现 {@code setScheduledPublishAt(null) + updateById} 被 MyBatis-Plus 默认
     * NOT_NULL 字段策略吞掉，列根本没清——实测取消后计划残留、到点文章仍被送审。
     * 只 touch 本列与 updated_at，不携带 lock_version 条件（与既有行为一致，
     * 且不会与并发正文保存互相覆盖字段）。
     */
    @Transactional
    public WorkingDraftView cancelSchedule(CommunityUser user, String articleId) {
        Article article = requireOwnedArticle(user, articleId);
        requireDraft(articleId);
        Instant now = Instant.now();
        int updated = draftMapper.update(null, new UpdateWrapper<WorkingDraft>()
                .eq("article_id", articleId)
                .set("scheduled_publish_at", null)
                .set("updated_at", now));
        if (updated == 0) {
            throw new ContractException(ErrorCode.NOT_FOUND, "工作草稿不存在");
        }
        articleMapper.update(null, new UpdateWrapper<Article>()
                .eq("id", articleId)
                .set("updated_at", now));
        // 视图直接反映持久化结果（该列已确认写 NULL）
        article.setUpdatedAt(now);
        WorkingDraft fresh = requireDraft(articleId);
        return toDraftView(article, fresh, listTopicIds(articleId));
    }

    /**
     * 恢复历史版本（D0 关联修复，2026-10-09）：与 saveDraft 同一写入纪律——
     * 条件 UPDATE 携带 {@code lock_version = expected}，并发保存期间恢复请求 affected=0 → 409，
     * 不再无条件覆盖；且 SET 子句显式列出全部恢复字段（含可空的 cover_url），
     * 旧实现 updateById 会把 revision 中为 null 的字段吞掉，导致恢复后残留新草稿的旧值。
     */
    @Transactional
    public WorkingDraftView restoreRevision(CommunityUser user, String articleId, String revisionId) {
        Article article = requireOwnedArticle(user, articleId);
        if (!ArticleStateSupport.canEditDraft(article)) {
            throw new ContractException(ErrorCode.CONFLICT, "文章当前不可恢复版本");
        }
        FormalRevision revision = formalRevisionMapper.selectById(revisionId);
        if (revision == null || !articleId.equals(revision.getArticleId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        WorkingDraft draft = requireDraft(articleId);
        long expected = draft.getLockVersion() == null ? 0L : draft.getLockVersion();
        Instant now = Instant.now();
        UpdateWrapper<WorkingDraft> draftUpdate = new UpdateWrapper<WorkingDraft>()
                .eq("article_id", articleId)
                .eq("lock_version", expected)
                .set("title", revision.getTitle())
                .set("summary", revision.getSummary())
                .set("cover_url", revision.getCoverUrl())
                .set("body_mode", revision.getBodyMode())
                .set("body", revision.getBody())
                .set("slug", revision.getSlug())
                .set("visibility", revision.getVisibility())
                .set("lock_version", expected + 1)
                .set("updated_at", now);
        int updated = draftMapper.update(null, draftUpdate);
        if (updated == 0) {
            throw new ContractException(ErrorCode.CONFLICT, "草稿已被他人更新，请刷新后重试");
        }
        articleMapper.update(null, new UpdateWrapper<Article>()
                .eq("id", articleId)
                .set("updated_at", now));
        Article freshArticle = articleMapper.selectById(articleId);
        WorkingDraft fresh = requireDraft(articleId);
        return toDraftView(freshArticle, fresh, listTopicIds(articleId));
    }

    public ArticlePublicView getPublicArticle(String articleId, CommunityUser viewer) {
        /*
         * 可见性判断只有一处：ArticleAccessService。
         *
         * 这里不再复制"生命周期 / 治理 / 已发布版本 / AccessPolicy"的判定，
         * 系列阅读进度也复用同一入口——两条路径对"能不能读"必须给同一个答案。
         */
        ArticleAccessService.ReadableArticle readable = articleAccessService.findReadable(articleId, viewer);
        if (readable == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Article article = readable.article();
        PublishedRevision published = readable.published();
        FormalRevision revision = readable.revision();
        boolean isOwner = viewer != null && viewer.getId().equals(article.getOwnerId());

        CommunityCreationSpace space = spaceService.requireSpaceForUserById(article.getSpaceId());
        CommunityProfile profile = profileMapper.findByUserId(article.getOwnerId());
        String categorySlug = null;
        if (article.getCategoryId() != null) {
            CreationSpaceCategory category = categoryMapper.selectById(article.getCategoryId());
            if (category != null) {
                categorySlug = category.getSlug();
            }
        }

        List<String> topicSlugs = listTopicIds(articleId).stream()
                .map(topicMapper::selectById)
                .filter(t -> t != null && isTopicSelectable(t))
                .map(Topic::getSlug)
                .toList();

        return ArticlePublicView.builder()
                .id(article.getId())
                .title(revision.getTitle())
                .summary(revision.getSummary())
                .coverUrl(revision.getCoverUrl())
                .bodyMode(revision.getBodyMode())
                .body(revision.getBody())
                .slug(revision.getSlug())
                .visibility(revision.getVisibility())
                .spaceSlug(space.getSlug())
                .ownerUsername(profile == null ? null : profile.getUsername())
                .ownerAvatar(profile == null ? null : ProfileSettingsSupport.resolveAvatar(profile))
                .ownerDisplayName(profile == null ? null : profile.getDisplayName())
                .categorySlug(categorySlug)
                .topicSlugs(topicSlugs)
                .publishedAt(published.getPublishedAt())
                .seriesContexts(seriesMapper.listActiveContextsByArticleId(articleId))
                .owner(isOwner)
                .build();
    }

    Article requireOwnedArticle(CommunityUser user, String articleId) {
        Article article = articleMapper.selectById(articleId);
        if (article == null || !user.getId().equals(article.getOwnerId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return article;
    }

    WorkingDraft requireDraft(String articleId) {
        WorkingDraft draft = draftMapper.findByArticleId(articleId);
        if (draft == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "工作草稿不存在");
        }
        return draft;
    }

    private ArticleSummaryView toSummary(Article article) {
        WorkingDraft draft = draftMapper.findByArticleId(article.getId());
        return ArticleSummaryView.builder()
                .id(article.getId())
                .status(article.getStatus())
                .lifecycleStatus(ArticleStateSupport.normalizeLifecycle(article.getLifecycleStatus()))
                .moderationStatus(ArticleStateSupport.normalizeModeration(article.getModerationStatus()))
                .title(draft == null ? null : draft.getTitle())
                .categoryId(article.getCategoryId())
                .updatedAt(article.getUpdatedAt())
                .build();
    }

    private WorkingDraftView toDraftView(Article article, WorkingDraft draft, List<String> topicIds) {
        return WorkingDraftView.builder()
                .articleId(article.getId())
                .title(draft.getTitle())
                .summary(draft.getSummary())
                .coverUrl(draft.getCoverUrl())
                .bodyMode(draft.getBodyMode())
                .body(draft.getBody())
                .slug(draft.getSlug())
                .visibility(draft.getVisibility())
                .categoryId(article.getCategoryId())
                .topicIds(topicIds)
                .lockVersion(draft.getLockVersion() == null ? 0L : draft.getLockVersion())
                .updatedAt(draft.getUpdatedAt())
                .scheduledPublishAt(draft.getScheduledPublishAt())
                .build();
    }

    private void requireOwnedCategory(String spaceId, String categoryId) {
        CreationSpaceCategory category = categoryMapper.selectById(categoryId);
        if (category == null || !spaceId.equals(category.getSpaceId())) {
            throw new FieldContractException("categoryId", "分类不存在");
        }
    }

    private List<String> listTopicIds(String articleId) {
        return articleTopicMapper.listByArticleId(articleId).stream()
                .map(ArticleTopic::getTopicId)
                .toList();
    }

    @SuppressWarnings("unchecked")
    private void syncTopics(String articleId, Object rawTopicIds) {
        articleTopicMapper.deleteByArticleId(articleId);
        if (!(rawTopicIds instanceof List<?> ids)) {
            return;
        }
        Instant now = Instant.now();
        for (Object raw : ids) {
            if (raw == null) {
                continue;
            }
            String topicId = String.valueOf(raw).trim();
            if (topicId.isBlank()) {
                continue;
            }
            Topic topic = topicMapper.selectById(topicId);
            if (topic == null || !isTopicSelectable(topic)) {
                throw new FieldContractException("topicIds", "话题不存在或未启用");
            }
            ArticleTopic link = new ArticleTopic();
            link.setArticleId(articleId);
            link.setTopicId(topicId);
            link.setCreatedAt(now);
            articleTopicMapper.insert(link);
        }
    }

    private static String parseBodyMode(Object raw) {
        if (raw == null) {
            return null;
        }
        String mode = String.valueOf(raw).trim().toUpperCase(Locale.ROOT);
        if (!"MARKDOWN".equals(mode) && !"RICH_TEXT".equals(mode)) {
            throw new FieldContractException("bodyMode", "正文模式无效");
        }
        return mode;
    }

    private static String parseVisibility(Object raw) {
        if (raw == null) {
            throw new FieldContractException("visibility", "可见性不能为空");
        }
        String visibility = String.valueOf(raw).trim().toUpperCase(Locale.ROOT);
        try {
            Visibility.valueOf(visibility);
        } catch (IllegalArgumentException ex) {
            throw new FieldContractException("visibility", "可见性值无效");
        }
        return visibility;
    }

    private static boolean isTopicSelectable(Topic topic) {
        String status = topic.getStatus();
        if (status == null) {
            return false;
        }
        status = status.trim().toUpperCase(Locale.ROOT);
        return "ACTIVE".equals(status) || "ENABLED".equals(status);
    }

    private static String trimToNull(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }

    private static Instant parseInstant(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        if (value.isEmpty()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (Exception ex) {
            throw new FieldContractException("scheduledPublishAt", "定时发布时间格式无效");
        }
    }
}
