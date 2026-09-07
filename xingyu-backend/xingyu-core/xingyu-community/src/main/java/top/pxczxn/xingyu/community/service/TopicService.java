package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.TopicAdminView;
import top.pxczxn.xingyu.community.dto.TopicCreatorView;
import top.pxczxn.xingyu.community.dto.TopicOwnerStat;
import top.pxczxn.xingyu.community.dto.TopicPublicView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ReservedWord;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.entity.TopicAlias;
import top.pxczxn.xingyu.community.entity.TopicFollow;
import top.pxczxn.xingyu.community.entity.TopicMergeRecord;
import top.pxczxn.xingyu.community.entity.ArticleTopic;
import top.pxczxn.xingyu.community.mapper.TopicMergeRecordMapper;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.ReservedWordMapper;
import top.pxczxn.xingyu.community.mapper.TopicAliasMapper;
import top.pxczxn.xingyu.community.mapper.TopicFollowMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.HashSet;

@Service
@RequiredArgsConstructor
public class TopicService {

    private static final java.util.regex.Pattern SLUG_PATTERN =
            java.util.regex.Pattern.compile("^[a-z0-9-]{2,64}$");

    private static final int MAX_TOPIC_DEPTH = 3;

    private final TopicMapper topicMapper;
    private final TopicAliasMapper topicAliasMapper;
    private final TopicFollowMapper topicFollowMapper;
    private final ArticleTopicMapper articleTopicMapper;
    private final ArticleMapper articleMapper;
    private final CommunityProfileMapper profileMapper;
    private final ReservedWordMapper reservedWordMapper;
    private final TopicMergeRecordMapper topicMergeRecordMapper;

    public List<Topic> list(String keyword, String status) {
        LambdaQueryWrapper<Topic> query = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String like = "%" + keyword.trim() + "%";
            query.and(w -> w.like(Topic::getName, like)
                    .or()
                    .like(Topic::getSlug, like)
                    .or()
                    .like(Topic::getDescription, like));
        }
        if (status != null && !status.isBlank()) {
            query.eq(Topic::getStatus, status.trim().toUpperCase(Locale.ROOT));
        }
        query.orderByAsc(Topic::getSlug);
        return topicMapper.selectList(query);
    }

    public List<TopicAdminView> listAdminViews(String keyword, String status) {
        return list(keyword, status).stream()
                .map(topic -> TopicAdminView.from(
                        topic,
                        topicFollowMapper.countByTopicId(topic.getId()),
                        articleTopicMapper.countPublicContent(topic.getId())))
                .toList();
    }

    @Transactional
    public Topic create(String slug, String name, String seedKey, String description) {
        String normalizedSlug = normalizeSlug(slug);
        validateSlug(normalizedSlug);
        if (topicMapper.findBySlug(normalizedSlug) != null) {
            throw new FieldContractException("slug", "别名已被占用");
        }
        String resolvedSeed = seedKey == null || seedKey.isBlank() ? normalizedSlug : seedKey.trim();
        if (topicMapper.findBySeedKey(resolvedSeed) != null) {
            throw new FieldContractException("seedKey", "种子键已存在");
        }
        Topic topic = new Topic();
        topic.setId(TokenSupport.newId());
        topic.setSeedKey(resolvedSeed);
        topic.setSlug(normalizedSlug);
        topic.setName(name == null ? normalizedSlug : name.trim());
        topic.setDescription(normalizeDescription(description));
        topic.setStatus("ACTIVE");
        topicMapper.insert(topic);
        return topic;
    }

    @Transactional
    public Topic update(String topicId, String slug, String name, String status, String description) {
        Topic topic = topicMapper.selectById(topicId);
        if (topic == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (slug != null && !slug.isBlank()) {
            String normalizedSlug = normalizeSlug(slug);
            validateSlug(normalizedSlug);
            Topic existing = topicMapper.findBySlug(normalizedSlug);
            if (existing != null && !existing.getId().equals(topicId)) {
                throw new FieldContractException("slug", "别名已被占用");
            }
            topic.setSlug(normalizedSlug);
        }
        if (name != null && !name.isBlank()) {
            topic.setName(name.trim());
        }
        if (description != null) {
            topic.setDescription(normalizeDescription(description));
        }
        if (status != null && !status.isBlank()) {
            String normalized = status.trim().toUpperCase(Locale.ROOT);
            if (!"ACTIVE".equals(normalized)
                    && !"ENABLED".equals(normalized)
                    && !"DISABLED".equals(normalized)
                    && !"MERGED".equals(normalized)) {
                throw new FieldContractException("status", "状态值无效");
            }
            if ("ENABLED".equals(normalized)) {
                normalized = "ACTIVE";
            }
            topic.setStatus(normalized);
        }
        topicMapper.updateById(topic);
        return topic;
    }

    private void validateSlug(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new FieldContractException("slug", "别名格式无效");
        }
        ReservedWord reserved = reservedWordMapper.selectById(slug);
        if (reserved != null && "slug".equals(reserved.getCategory())) {
            throw new FieldContractException("slug", "别名不可用");
        }
    }

    private static String normalizeSlug(String slug) {
        return slug == null ? "" : slug.trim().toLowerCase(Locale.ROOT);
    }

    private static String normalizeDescription(String description) {
        if (description == null) {
            return null;
        }
        String trimmed = description.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public List<Topic> listPublic(String keyword) {
        LambdaQueryWrapper<Topic> query = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String like = "%" + keyword.trim() + "%";
            query.and(w -> w.like(Topic::getName, like).or().like(Topic::getSlug, like));
        }
        query.in(Topic::getStatus, List.of("ACTIVE", "ENABLED"));
        query.orderByAsc(Topic::getSlug);
        return topicMapper.selectList(query);
    }

    public List<TopicPublicView> listPublicViews(String keyword) {
        CommunityUser viewer = CommunityAuthContext.currentUser().orElse(null);
        return listPublic(keyword).stream()
                .map(topic -> toPublicView(topic, viewer))
                .toList();
    }

    public TopicPublicView getPublicView(String rawSlug) {
        Topic topic = requireEnabledBySlug(rawSlug);
        CommunityUser viewer = CommunityAuthContext.currentUser().orElse(null);
        return toPublicView(topic, viewer);
    }

    public List<ContentCardView> listContent(String rawSlug, String sort, int limit) {
        Topic topic = requireEnabledBySlug(rawSlug);
        if (limit <= 0) {
            limit = 12;
        }
        List<SearchDocument> documents = "hot".equalsIgnoreCase(sort)
                ? articleTopicMapper.listHotContent(topic.getId(), limit)
                : articleTopicMapper.listLatestContent(topic.getId(), limit);
        return documents.stream().map(this::toContentCard).toList();
    }

    public List<TopicCreatorView> listCreators(String rawSlug, int limit) {
        Topic topic = requireEnabledBySlug(rawSlug);
        if (limit <= 0) {
            limit = 12;
        }
        return articleTopicMapper.listTopOwners(topic.getId(), limit).stream()
                .map(this::toCreatorView)
                .toList();
    }

    public Topic requireEnabledBySlug(String rawSlug) {
        Topic topic = resolveBySlug(rawSlug);
        if (topic == null || !isTopicActive(topic)) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return topic;
    }

    private Topic resolveBySlug(String rawSlug) {
        String slug = normalizeSlug(rawSlug);
        Topic topic = topicMapper.findBySlug(slug);
        if (topic != null) {
            return topic;
        }
        TopicAlias alias = topicAliasMapper.findByAliasSlug(slug);
        if (alias == null) {
            return null;
        }
        return topicMapper.selectById(alias.getTopicId());
    }

    private TopicPublicView toPublicView(Topic topic, CommunityUser viewer) {
        long followerCount = topicFollowMapper.countByTopicId(topic.getId());
        long contentCount = articleTopicMapper.countPublicContent(topic.getId());
        Boolean following = null;
        if (viewer != null) {
            following = topicFollowMapper.findByUserAndTopic(viewer.getId(), topic.getId()) != null;
        }
        return TopicPublicView.from(topic, followerCount, contentCount, following);
    }

    private ContentCardView toContentCard(SearchDocument document) {
        String authorName = null;
        if ("ARTICLE".equals(document.getObjectType())) {
            var article = articleMapper.selectById(document.getObjectId());
            if (article != null) {
                CommunityProfile profile = profileMapper.findByUserId(article.getOwnerId());
                if (profile != null) {
                    authorName = profile.getDisplayName() == null || profile.getDisplayName().isBlank()
                            ? profile.getUsername()
                            : profile.getDisplayName();
                }
            }
        }
        return ContentCardView.builder()
                .id(document.getObjectId())
                .objectType(document.getObjectType())
                .title(document.getTitle())
                .summary(document.getSummary())
                .authorName(authorName)
                .updatedAt(document.getIndexedAt())
                .build();
    }

    private TopicCreatorView toCreatorView(TopicOwnerStat stat) {
        CommunityProfile profile = profileMapper.findByUserId(stat.getOwnerId());
        return TopicCreatorView.builder()
                .username(profile == null ? stat.getOwnerId() : profile.getUsername())
                .displayName(profile == null ? null : profile.getDisplayName())
                .contentCount(stat.getContentCount())
                .build();
    }

    public List<TopicAlias> listAliases(String topicId) {
        requireTopic(topicId);
        return topicAliasMapper.listByTopicId(topicId);
    }

    @Transactional
    public TopicAlias addAlias(String topicId, String aliasSlug) {
        Topic topic = requireTopic(topicId);
        if ("MERGED".equals(topic.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "已合并话题不可新增别名");
        }
        String normalized = normalizeSlug(aliasSlug);
        validateSlug(normalized);
        if (topicMapper.findBySlug(normalized) != null) {
            throw new FieldContractException("aliasSlug", "别名已被话题占用");
        }
        if (topicAliasMapper.findByAliasSlug(normalized) != null) {
            throw new FieldContractException("aliasSlug", "别名已存在");
        }
        if (normalized.equals(topic.getSlug())) {
            throw new FieldContractException("aliasSlug", "不能与主 slug 相同");
        }
        TopicAlias alias = new TopicAlias();
        alias.setId(TokenSupport.newId());
        alias.setTopicId(topicId);
        alias.setAliasSlug(normalized);
        alias.setCreatedAt(Instant.now());
        topicAliasMapper.insert(alias);
        return alias;
    }

    @Transactional
    public Topic setParentTopic(String topicId, String parentTopicId) {
        Topic topic = requireTopic(topicId);
        if (parentTopicId == null || parentTopicId.isBlank()) {
            topic.setParentTopicId(null);
            topicMapper.updateById(topic);
            return topic;
        }
        if (topicId.equals(parentTopicId)) {
            throw new FieldContractException("parentTopicId", "不能设置自己为父话题");
        }
        Topic parent = requireTopic(parentTopicId);
        if (!isTopicActive(parent)) {
            throw new FieldContractException("parentTopicId", "父话题不可用");
        }
        int parentDepth = topicDepth(parentTopicId);
        if (parentDepth >= MAX_TOPIC_DEPTH) {
            throw new FieldContractException("parentTopicId", "父话题已达最大层级");
        }
        if (createsTopicCycle(topicId, parentTopicId)) {
            throw new FieldContractException("parentTopicId", "不能形成环状层级");
        }
        topic.setParentTopicId(parentTopicId);
        topicMapper.updateById(topic);
        return topic;
    }

    @Transactional
    public TopicMergeRecord mergeTopics(String sourceTopicId, String targetTopicId, String operatorId) {
        if (sourceTopicId.equals(targetTopicId)) {
            throw new FieldContractException("targetTopicId", "源与目标不能相同");
        }
        Topic source = requireTopic(sourceTopicId);
        Topic target = requireTopic(targetTopicId);
        if (!isTopicActive(target)) {
            throw new FieldContractException("targetTopicId", "目标话题不可用");
        }
        if ("MERGED".equals(source.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "源话题已合并");
        }
        Instant now = Instant.now();

        for (ArticleTopic link : articleTopicMapper.listByTopicId(sourceTopicId)) {
            boolean hasTarget = articleTopicMapper.listByArticleId(link.getArticleId()).stream()
                    .anyMatch(item -> targetTopicId.equals(item.getTopicId()));
            articleTopicMapper.deleteLink(link.getArticleId(), sourceTopicId);
            if (!hasTarget) {
                ArticleTopic migrated = new ArticleTopic();
                migrated.setArticleId(link.getArticleId());
                migrated.setTopicId(targetTopicId);
                migrated.setCreatedAt(link.getCreatedAt() == null ? now : link.getCreatedAt());
                articleTopicMapper.insert(migrated);
            }
        }

        for (TopicFollow follow : topicFollowMapper.listByTopicId(sourceTopicId)) {
            if (topicFollowMapper.findByUserAndTopic(follow.getUserId(), targetTopicId) == null) {
                follow.setTopicId(targetTopicId);
                topicFollowMapper.updateById(follow);
            } else {
                topicFollowMapper.deleteByUserAndTopic(follow.getUserId(), sourceTopicId);
            }
        }

        addAliasInternal(targetTopicId, source.getSlug(), now);

        source.setStatus("MERGED");
        topicMapper.updateById(source);

        TopicMergeRecord record = new TopicMergeRecord();
        record.setId(TokenSupport.newId());
        record.setSourceTopicId(sourceTopicId);
        record.setTargetTopicId(targetTopicId);
        record.setOperatorId(operatorId);
        record.setMergedAt(now);
        topicMergeRecordMapper.insert(record);
        return record;
    }

    private Topic requireTopic(String topicId) {
        Topic topic = topicMapper.selectById(topicId);
        if (topic == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return topic;
    }

    private static boolean isTopicActive(Topic topic) {
        if (topic == null || topic.getStatus() == null) {
            return false;
        }
        String status = topic.getStatus().trim().toUpperCase(Locale.ROOT);
        return "ACTIVE".equals(status) || "ENABLED".equals(status);
    }

    private int topicDepth(String topicId) {
        int depth = 1;
        Set<String> visited = new HashSet<>();
        String currentId = topicId;
        while (currentId != null && !currentId.isBlank()) {
            if (!visited.add(currentId)) {
                return MAX_TOPIC_DEPTH + 1;
            }
            Topic current = topicMapper.selectById(currentId);
            if (current == null || current.getParentTopicId() == null || current.getParentTopicId().isBlank()) {
                break;
            }
            currentId = current.getParentTopicId();
            depth++;
        }
        return depth;
    }

    private boolean createsTopicCycle(String topicId, String parentTopicId) {
        String currentId = parentTopicId;
        Set<String> visited = new HashSet<>();
        while (currentId != null && !currentId.isBlank()) {
            if (topicId.equals(currentId)) {
                return true;
            }
            if (!visited.add(currentId)) {
                return true;
            }
            Topic current = topicMapper.selectById(currentId);
            if (current == null) {
                break;
            }
            currentId = current.getParentTopicId();
        }
        return false;
    }

    private void addAliasInternal(String topicId, String aliasSlug, Instant now) {
        String normalized = normalizeSlug(aliasSlug);
        if (normalized.isBlank()) {
            return;
        }
        if (topicMapper.findBySlug(normalized) != null) {
            return;
        }
        if (topicAliasMapper.findByAliasSlug(normalized) != null) {
            return;
        }
        TopicAlias alias = new TopicAlias();
        alias.setId(TokenSupport.newId());
        alias.setTopicId(topicId);
        alias.setAliasSlug(normalized);
        alias.setCreatedAt(now);
        topicAliasMapper.insert(alias);
    }
}
