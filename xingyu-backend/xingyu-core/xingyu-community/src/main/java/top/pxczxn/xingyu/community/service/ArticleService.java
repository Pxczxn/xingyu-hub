package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.common.contract.access.AccessPolicy;
import top.pxczxn.xingyu.common.contract.access.AccessorContext;
import top.pxczxn.xingyu.common.contract.access.ResourceAccess;
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
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
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
    private final CommunityProfileMapper profileMapper;
    private final TopicMapper topicMapper;
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
            throw new ContractException(ErrorCode.CONFLICT, "草稿已被他人更新，请刷新后重试");
        }

        if (body.containsKey("title")) {
            draft.setTitle(trimToNull(body.get("title")));
        }
        if (body.containsKey("summary")) {
            draft.setSummary(trimToNull(body.get("summary")));
        }
        if (body.containsKey("bodyMode")) {
            draft.setBodyMode(parseBodyMode(body.get("bodyMode")));
        }
        if (body.containsKey("body")) {
            draft.setBody(trimToNull(body.get("body")));
        }
        if (body.containsKey("slug")) {
            draft.setSlug(trimToNull(body.get("slug")));
        }
        if (body.containsKey("visibility")) {
            draft.setVisibility(parseVisibility(body.get("visibility")));
        }

        if (body.containsKey("categoryId")) {
            String categoryId = trimToNull(body.get("categoryId"));
            if (categoryId != null) {
                requireOwnedCategory(article.getSpaceId(), categoryId);
            }
            article.setCategoryId(categoryId);
        }

        if (body.containsKey("scheduledPublishAt")) {
            draft.setScheduledPublishAt(parseInstant(body.get("scheduledPublishAt")));
        }

        draft.setLockVersion(expected + 1);
        draft.setUpdatedAt(Instant.now());
        article.setUpdatedAt(draft.getUpdatedAt());
        draftMapper.updateById(draft);
        articleMapper.updateById(article);

        if (body.containsKey("topicIds")) {
            syncTopics(articleId, body.get("topicIds"));
        }

        eventSupport.publishArticleEvent(
                "draft-changed:" + articleId + ":" + draft.getLockVersion(),
                CommunityEventSupport.DRAFT_CHANGED,
                articleId);

        return toDraftView(article, draft, listTopicIds(articleId));
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

    @Transactional
    public WorkingDraftView cancelSchedule(CommunityUser user, String articleId) {
        Article article = requireOwnedArticle(user, articleId);
        WorkingDraft draft = requireDraft(articleId);
        draft.setScheduledPublishAt(null);
        draft.setUpdatedAt(Instant.now());
        article.setUpdatedAt(draft.getUpdatedAt());
        draftMapper.updateById(draft);
        articleMapper.updateById(article);
        return toDraftView(article, draft, listTopicIds(articleId));
    }

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
        draft.setTitle(revision.getTitle());
        draft.setSummary(revision.getSummary());
        draft.setBodyMode(revision.getBodyMode());
        draft.setBody(revision.getBody());
        draft.setSlug(revision.getSlug());
        draft.setVisibility(revision.getVisibility());
        draft.setLockVersion((draft.getLockVersion() == null ? 0L : draft.getLockVersion()) + 1);
        draft.setUpdatedAt(Instant.now());
        draftMapper.updateById(draft);
        article.setUpdatedAt(draft.getUpdatedAt());
        articleMapper.updateById(article);
        return toDraftView(article, draft, listTopicIds(articleId));
    }

    public ArticlePublicView getPublicArticle(String articleId, CommunityUser viewer) {
        Article article = articleMapper.selectById(articleId);
        if (article == null || !ArticleStateSupport.isActiveLifecycle(article)) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (ArticleStateSupport.MODERATION_HIDDEN.equals(
                ArticleStateSupport.normalizeModeration(article.getModerationStatus()))) {
            boolean isOwner = viewer != null && viewer.getId().equals(article.getOwnerId());
            if (!isOwner) {
                throw new ContractException(ErrorCode.NOT_FOUND);
            }
        }

        PublishedRevision published = publishedRevisionMapper.findByArticleId(articleId);
        if (published == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        FormalRevision revision = formalRevisionMapper.selectById(published.getFormalRevisionId());
        if (revision == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        boolean isOwner = viewer != null && viewer.getId().equals(article.getOwnerId());
        Visibility visibility = Visibility.valueOf(revision.getVisibility());
        var decision = AccessPolicy.evaluate(
                ResourceAccess.builder()
                        .exists(true)
                        .ownerId(ObjectId.of(article.getOwnerId()))
                        .visibility(visibility)
                        .ownerActive(true)
                        .resourceActive(true)
                        .underReview(ArticleStateSupport.isUnderReview(article))
                        .build(),
                isOwner
                        ? AccessorContext.authenticated(ObjectId.of(viewer.getId()))
                        : AccessorContext.anonymous());
        if (!decision.isAllowed()) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

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
                .bodyMode(revision.getBodyMode())
                .body(revision.getBody())
                .slug(revision.getSlug())
                .visibility(revision.getVisibility())
                .spaceSlug(space.getSlug())
                .ownerUsername(profile == null ? null : profile.getUsername())
                .categorySlug(categorySlug)
                .topicSlugs(topicSlugs)
                .publishedAt(published.getPublishedAt())
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
