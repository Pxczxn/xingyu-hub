package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.DiscoverNavTabView;
import top.pxczxn.xingyu.community.dto.ExploreDomainView;
import top.pxczxn.xingyu.community.dto.ExploreNavTabView;
import top.pxczxn.xingyu.community.dto.ExploreNavView;
import top.pxczxn.xingyu.community.dto.UserExploreView;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ExploreDomain;
import top.pxczxn.xingyu.community.entity.ExploreDomainApplication;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.UserExploreDomain;
import top.pxczxn.xingyu.community.mapper.ContentTagMapper;
import top.pxczxn.xingyu.community.mapper.ExploreDomainApplicationMapper;
import top.pxczxn.xingyu.community.mapper.ExploreDomainMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.UserExploreDomainMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ExplorationService {

    private final ExploreDomainMapper exploreDomainMapper;
    private final UserExploreDomainMapper userExploreDomainMapper;
    private final ContentTagMapper contentTagMapper;
    private final ExploreDomainApplicationMapper exploreDomainApplicationMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final FeedService feedService;
    private final RecommendationService recommendationService;

    public List<ExploreDomainView> listOfficialMap() {
        List<ExploreDomain> roots = exploreDomainMapper.listRootSystemDomains();
        if (roots.isEmpty()) {
            return List.of();
        }
        Map<String, List<ExploreDomain>> childrenByParent = new HashMap<>();
        for (ExploreDomain child : exploreDomainMapper.listSystemChildrenByParentIds(
                roots.stream().map(ExploreDomain::getId).toList())) {
            childrenByParent.computeIfAbsent(child.getParentId(), key -> new ArrayList<>()).add(child);
        }
        return roots.stream()
                .map(root -> toDomainView(root, childrenByParent.getOrDefault(root.getId(), List.of())))
                .toList();
    }

    public ExploreNavView composeNav(CommunityUser user) {
        List<ExploreNavTabView> domainTabs;
        String mode;
        String sectionTitle;
        String feedHint;
        boolean canManage = user != null;

        if (user == null) {
            mode = "guest";
            sectionTitle = "热门星域";
            feedHint = "从官方领域星图开始探索社区内容";
            domainTabs = exploreDomainMapper.listRootSystemDomains().stream()
                    .map(domain -> ExploreNavTabView.builder()
                            .key(domain.getSlug())
                            .label(domain.getName())
                            .description(domain.getDescription())
                            .defaultSelected("tech".equals(domain.getSlug()))
                            .personal(false)
                            .build())
                    .toList();
        } else {
            List<ExploreDomain> selected = exploreDomainMapper.listByUserExploration(user.getId());
            if (selected.isEmpty()) {
                selected = exploreDomainMapper.listPersonalByUser(user.getId());
            }
            if (selected.isEmpty()) {
                mode = "guest";
                sectionTitle = "热门星域";
                feedHint = "选择你的探索方向，获得更精准推荐";
                domainTabs = exploreDomainMapper.listRootSystemDomains().stream()
                        .map(domain -> ExploreNavTabView.builder()
                                .key(domain.getSlug())
                                .label(domain.getName())
                                .description(domain.getDescription())
                                .defaultSelected("tech".equals(domain.getSlug()))
                                .personal(false)
                                .build())
                        .toList();
                canManage = true;
            } else {
                mode = "user";
                sectionTitle = "全部";
                feedHint = "根据你的探索方向推荐";
                domainTabs = selected.stream()
                        .map(domain -> ExploreNavTabView.builder()
                                .key(domain.getSlug())
                                .label(domain.getName())
                                .description(domain.getDescription())
                                .defaultSelected(false)
                                .personal("PERSONAL".equals(domain.getDomainType()))
                                .build())
                        .toList();
            }
        }

        return ExploreNavView.builder()
                .mode(mode)
                .sectionTitle(sectionTitle)
                .feedHint(feedHint)
                .canManage(canManage)
                .domainTabs(domainTabs)
                .sortTabs(sortTabs())
                .build();
    }

    public UserExploreView getUserExploration(CommunityUser user) {
        List<ExploreDomain> domains = exploreDomainMapper.listByUserExploration(user.getId());
        List<ExploreDomain> personal = exploreDomainMapper.listPersonalByUser(user.getId());
        List<ExploreDomainView> merged = new ArrayList<>();
        for (ExploreDomain domain : domains) {
            merged.add(toDomainView(domain));
        }
        for (ExploreDomain domain : personal) {
            if (domains.stream().noneMatch(item -> item.getId().equals(domain.getId()))) {
                merged.add(toDomainView(domain));
            }
        }
        List<String> customLabels = personal.stream().map(ExploreDomain::getName).toList();
        return UserExploreView.builder()
                .domains(merged)
                .customLabels(customLabels)
                .build();
    }

    @Transactional
    public UserExploreView updateUserExploration(CommunityUser user, Map<String, Object> body) {
        List<String> domainIds = readStringList(body.get("domainIds"));
        List<String> customLabels = readStringList(body.get("customLabels"));

        userExploreDomainMapper.deleteByUserId(user.getId());

        List<String> lookupIds = new ArrayList<>();
        for (String domainId : domainIds) {
            if (domainId != null && !domainId.isBlank() && !lookupIds.contains(domainId)) {
                lookupIds.add(domainId);
            }
        }
        Map<String, ExploreDomain> activeDomains = new HashMap<>();
        if (!lookupIds.isEmpty()) {
            for (ExploreDomain domain : exploreDomainMapper.listActiveByIds(lookupIds)) {
                if (domain != null && domain.getId() != null) {
                    activeDomains.putIfAbsent(domain.getId(), domain);
                }
            }
        }
        int sort = 0;
        List<UserExploreDomain> systemLinks = new ArrayList<>();
        for (String domainId : domainIds) {
            ExploreDomain domain = activeDomains.get(domainId);
            if (domain == null || !"SYSTEM".equals(domain.getDomainType())) {
                continue;
            }
            UserExploreDomain link = new UserExploreDomain();
            link.setId(TokenSupport.newId());
            link.setUserId(user.getId());
            link.setDomainId(domain.getId());
            link.setSortOrder(sort++);
            link.setCreatedAt(Instant.now());
            systemLinks.add(link);
        }
        if (!systemLinks.isEmpty()) {
            userExploreDomainMapper.insertAll(systemLinks);
        }

        List<ExploreDomain> existingPersonal = exploreDomainMapper.listPersonalByUser(user.getId());
        Set<String> keepNames = new LinkedHashSet<>(customLabels);
        if (!existingPersonal.isEmpty()) {
            List<String> retainedNames = new ArrayList<>();
            for (String name : keepNames) {
                if (name != null && !name.isBlank()) {
                    retainedNames.add(name);
                }
            }
            if (retainedNames.isEmpty()) {
                exploreDomainMapper.archiveAllPersonalByUser(user.getId());
            } else {
                exploreDomainMapper.archivePersonalExceptNames(user.getId(), retainedNames);
            }
        }
        for (ExploreDomain personal : existingPersonal) {
            keepNames.remove(personal.getName());
        }

        List<ExploreDomain> createdPersonal = new ArrayList<>();
        List<UserExploreDomain> personalLinks = new ArrayList<>();
        for (String label : keepNames) {
            if (label == null || label.isBlank()) {
                continue;
            }
            ExploreDomain personal = new ExploreDomain();
            personal.setId(TokenSupport.newId());
            personal.setSlug(slugify(label) + "-" + user.getId().substring(0, 8));
            personal.setName(label.trim());
            personal.setDescription("个人探索方向");
            personal.setDomainType("PERSONAL");
            personal.setOwnerUserId(user.getId());
            personal.setStatus("ACTIVE");
            personal.setSortOrder(sort++);
            personal.setCreatedAt(Instant.now());
            createdPersonal.add(personal);

            UserExploreDomain link = new UserExploreDomain();
            link.setId(TokenSupport.newId());
            link.setUserId(user.getId());
            link.setDomainId(personal.getId());
            link.setSortOrder(sort++);
            link.setCreatedAt(Instant.now());
            personalLinks.add(link);
        }
        if (!createdPersonal.isEmpty()) {
            exploreDomainMapper.insertAll(createdPersonal);
            userExploreDomainMapper.insertAll(personalLinks);
        }

        return getUserExploration(user);
    }

    /**
     * 用户主动选择的探索领域，含子领域。没有选择时返回空，不回退到全部官方领域。
     */
    public List<String> selectedDomainIds(String userId) {
        List<ExploreDomain> selected = exploreDomainMapper.listByUserExploration(userId);
        if (selected.isEmpty()) {
            return List.of();
        }
        return expandDomainIds(selected);
    }

    public List<ContentCardView> feedForDomain(CommunityUser user, String domainSlug, String sort, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        List<String> domainIds = resolveDomainScope(domainSlug, user);
        List<ContentCardView> domainCards = loadDomainCards(domainIds, limit);
        if (!domainCards.isEmpty()) {
            return domainCards;
        }

        String feedType = mapSortToFeedType(sort);
        return feedService.getFeed(user, feedType, 0, limit).stream()
                .map(item -> ContentCardView.builder()
                        .id(item.getId())
                        .objectType(item.getType())
                        .title(item.getTitle())
                        .summary(item.getSummary())
                        .updatedAt(item.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional
    public void applyDomain(CommunityUser user, Map<String, Object> body) {
        String name = readString(body.get("name"));
        String description = readString(body.get("description"));
        if (name == null || name.isBlank()) {
            throw new FieldContractException("name", "领域名称不能为空");
        }
        if (description == null || description.isBlank()) {
            throw new FieldContractException("description", "领域简介不能为空");
        }
        ExploreDomainApplication application = new ExploreDomainApplication();
        application.setId(TokenSupport.newId());
        application.setUserId(user.getId());
        application.setProposedName(name.trim());
        application.setDescription(description.trim());
        application.setStatus("PENDING");
        application.setCreatedAt(Instant.now());
        exploreDomainApplicationMapper.insert(application);
    }

    private List<ContentCardView> loadDomainCards(List<String> domainIds, int limit) {
        if (domainIds.isEmpty()) {
            return List.of();
        }
        List<String> articleIds = contentTagMapper.listArticleIdsByDomains(domainIds, limit);
        Map<String, SearchDocument> documents = new HashMap<>();
        if (!articleIds.isEmpty()) {
            for (SearchDocument document : searchDocumentMapper.findLiveByTypeAndIds("ARTICLE", articleIds)) {
                documents.putIfAbsent(document.getObjectId(), document);
            }
        }
        List<ContentCardView> cards = new ArrayList<>();
        for (String articleId : articleIds) {
            SearchDocument document = documents.get(articleId);
            if (document == null) {
                continue;
            }
            cards.add(ContentCardView.builder()
                    .id(document.getObjectId())
                    .objectType(document.getObjectType())
                    .title(document.getTitle())
                    .summary(document.getSummary())
                    .updatedAt(document.getIndexedAt())
                    .build());
        }
        if (cards.size() < limit) {
            for (ContentCardView card : recommendationService.recommend(null, limit).getItems()) {
                if (cards.stream().noneMatch(existing -> existing.getId().equals(card.getId()))) {
                    cards.add(card);
                }
                if (cards.size() >= limit) {
                    break;
                }
            }
        }
        return cards.stream().limit(limit).toList();
    }

    private List<String> resolveDomainScope(String domainSlug, CommunityUser user) {
        if (domainSlug == null || domainSlug.isBlank() || "all".equals(domainSlug)) {
            if (user != null) {
                List<ExploreDomain> selected = exploreDomainMapper.listByUserExploration(user.getId());
                if (!selected.isEmpty()) {
                    return expandDomainIds(selected);
                }
            }
            return exploreDomainMapper.listRootSystemDomains().stream()
                    .map(ExploreDomain::getId)
                    .toList();
        }

        ExploreDomain domain = exploreDomainMapper.findSystemBySlug(domainSlug);
        if (domain == null && user != null) {
            domain = exploreDomainMapper.listPersonalByUser(user.getId()).stream()
                    .filter(item -> item.getSlug().equals(domainSlug))
                    .findFirst()
                    .orElse(null);
        }
        if (domain == null) {
            return List.of();
        }
        return expandDomainIds(List.of(domain));
    }

    private List<String> expandDomainIds(List<ExploreDomain> domains) {
        if (domains.isEmpty()) {
            return List.of();
        }
        Map<String, List<String>> childrenByParent = new HashMap<>();
        for (ExploreDomain child : exploreDomainMapper.listActiveChildrenByParentIds(
                domains.stream().map(ExploreDomain::getId).toList())) {
            if (child.getId() != null && child.getParentId() != null) {
                childrenByParent.computeIfAbsent(child.getParentId(), key -> new ArrayList<>()).add(child.getId());
            }
        }
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        for (ExploreDomain domain : domains) {
            ids.add(domain.getId());
            ids.addAll(childrenByParent.getOrDefault(domain.getId(), List.of()));
        }
        return List.copyOf(ids);
    }

    private ExploreDomainView toDomainView(ExploreDomain domain, List<ExploreDomain> children) {
        return ExploreDomainView.builder()
                .id(domain.getId())
                .slug(domain.getSlug())
                .name(domain.getName())
                .description(domain.getDescription())
                .icon(domain.getIcon())
                .parentId(domain.getParentId())
                .domainType(domain.getDomainType())
                .personal("PERSONAL".equals(domain.getDomainType()))
                .children(children.stream().map(this::toDomainView).toList())
                .build();
    }

    private ExploreDomainView toDomainView(ExploreDomain domain) {
        return ExploreDomainView.builder()
                .id(domain.getId())
                .slug(domain.getSlug())
                .name(domain.getName())
                .description(domain.getDescription())
                .icon(domain.getIcon())
                .parentId(domain.getParentId())
                .domainType(domain.getDomainType())
                .personal("PERSONAL".equals(domain.getDomainType()))
                .children(List.of())
                .build();
    }

    private List<DiscoverNavTabView> sortTabs() {
        return List.of(
                sortTab("featured", "精选", true),
                sortTab("latest", "最新", false),
                sortTab("hot", "近期热门", false),
                sortTab("interest", "兴趣相关", false));
    }

    private DiscoverNavTabView sortTab(String key, String label, boolean defaultSelected) {
        return DiscoverNavTabView.builder()
                .key(key)
                .label(label)
                .defaultSelected(defaultSelected)
                .build();
    }

    private List<ExploreNavTabView> withDefaultSelected(List<ExploreNavTabView> tabs, int index) {
        List<ExploreNavTabView> result = new ArrayList<>();
        for (int i = 0; i < tabs.size(); i++) {
            ExploreNavTabView tab = tabs.get(i);
            result.add(ExploreNavTabView.builder()
                    .key(tab.getKey())
                    .label(tab.getLabel())
                    .description(tab.getDescription())
                    .defaultSelected(i == index)
                    .personal(tab.isPersonal())
                    .build());
        }
        return result;
    }

    private String mapSortToFeedType(String sort) {
        if (sort == null) {
            return "recommended";
        }
        return switch (sort.toLowerCase(Locale.ROOT)) {
            case "latest" -> "latest";
            case "hot" -> "hot";
            default -> "recommended";
        };
    }

    private String slugify(String value) {
        return value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", "-")
                .replaceAll("[^a-z0-9\\-]", "");
    }

    private String readString(Object raw) {
        return raw == null ? null : String.valueOf(raw);
    }

    @SuppressWarnings("unchecked")
    private List<String> readStringList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (Object item : list) {
            if (item != null) {
                values.add(String.valueOf(item));
            }
        }
        return values;
    }
}
