package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.dto.SpacePublicView;
import top.pxczxn.xingyu.community.dto.SpaceWorksView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CreationSpaceCategory;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityCreationSpaceMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CreationSpaceCategoryMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.UsernameHistoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CreationSpaceService {

    private final CommunityProfileMapper profileMapper;
    private final UsernameHistoryMapper usernameHistoryMapper;
    private final CommunityCreationSpaceMapper spaceMapper;
    private final CreationSpaceCategoryMapper categoryMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final ArticleMapper articleMapper;

    public SpaceWorksView getPublicWorks(String rawUsername, CommunityUser viewer, String categorySlug, int limit) {
        CommunityProfile profile = resolveProfile(rawUsername);
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        CommunityCreationSpace space = spaceMapper.findByUserId(profile.getUserId());
        if (space == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        boolean isOwner = viewer != null && viewer.getId().equals(profile.getUserId());
        if ("PRIVATE".equals(profile.getVisibility()) && !isOwner) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        List<CreationSpaceCategory> categories = categoryMapper.listBySpaceId(space.getId()).stream()
                .filter(c -> isOwner || "ACTIVE".equals(c.getStatus()))
                .toList();

        List<SpaceWorksView.CategorySummary> categorySummaries = categories.stream()
                .map(c -> SpaceWorksView.CategorySummary.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .slug(c.getSlug())
                        .build())
                .toList();

        List<SpaceWorksView.WorkSummary> works = listPublishedWorks(
                space.getId(), categorySlug, isOwner, limit);

        return SpaceWorksView.builder()
                .username(profile.getUsername())
                .spaceSlug(space.getSlug())
                .displayName(space.getDisplayName() != null ? space.getDisplayName() : profile.getDisplayName())
                .description(space.getDescription())
                .owner(isOwner)
                .categories(categorySummaries)
                .works(works)
                .nextCursor(null)
                .build();
    }

    public SpacePublicView getPublicSpace(String spaceSlug, CommunityUser viewer) {
        CommunityCreationSpace space = requireSpaceBySlug(spaceSlug);
        CommunityProfile profile = profileMapper.findByUserId(space.getUserId());
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        boolean isOwner = viewer != null && viewer.getId().equals(space.getUserId());
        if ("PRIVATE".equals(profile.getVisibility()) && !isOwner) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        List<SpaceWorksView.CategorySummary> categories = categoryMapper.listBySpaceId(space.getId()).stream()
                .filter(c -> isOwner || "ACTIVE".equals(c.getStatus()))
                .map(c -> SpaceWorksView.CategorySummary.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .slug(c.getSlug())
                        .build())
                .toList();

        return SpacePublicView.builder()
                .spaceSlug(space.getSlug())
                .displayName(space.getDisplayName() != null ? space.getDisplayName() : profile.getDisplayName())
                .description(space.getDescription())
                .ownerUsername(profile.getUsername())
                .categories(categories)
                .build();
    }

    public SpaceWorksView getPublicWorksBySpaceSlug(
            String spaceSlug, CommunityUser viewer, String categorySlug, int limit) {
        CommunityCreationSpace space = requireSpaceBySlug(spaceSlug);
        CommunityProfile profile = profileMapper.findByUserId(space.getUserId());
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        boolean isOwner = viewer != null && viewer.getId().equals(space.getUserId());
        if ("PRIVATE".equals(profile.getVisibility()) && !isOwner) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        List<CreationSpaceCategory> categories = categoryMapper.listBySpaceId(space.getId()).stream()
                .filter(c -> isOwner || "ACTIVE".equals(c.getStatus()))
                .toList();

        List<SpaceWorksView.CategorySummary> categorySummaries = categories.stream()
                .map(c -> SpaceWorksView.CategorySummary.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .slug(c.getSlug())
                        .build())
                .toList();

        List<SpaceWorksView.WorkSummary> works = listPublishedWorks(
                space.getId(), categorySlug, isOwner, limit);

        return SpaceWorksView.builder()
                .username(profile.getUsername())
                .spaceSlug(space.getSlug())
                .displayName(space.getDisplayName() != null ? space.getDisplayName() : profile.getDisplayName())
                .description(space.getDescription())
                .owner(isOwner)
                .categories(categorySummaries)
                .works(works)
                .nextCursor(null)
                .build();
    }

    public List<SpaceWorksView.CategorySummary> getPublicCategories(String rawUsername, CommunityUser viewer) {
        return getPublicWorks(rawUsername, viewer, null, 20).getCategories();
    }

    public CommunityCreationSpace requireSpaceForUser(CommunityUser user) {
        CommunityCreationSpace space = spaceMapper.findByUserId(user.getId());
        if (space == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "创作空间不存在");
        }
        return space;
    }

    public CommunityCreationSpace requireSpaceBySlug(String rawSlug) {
        String slug = rawSlug == null ? "" : rawSlug.trim().toLowerCase(Locale.ROOT);
        CommunityCreationSpace space = spaceMapper.findBySlug(slug);
        if (space == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return space;
    }

    public CommunityCreationSpace requireSpaceForUserById(String spaceId) {
        CommunityCreationSpace space = spaceMapper.selectById(spaceId);
        if (space == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return space;
    }

    private CommunityProfile resolveProfile(String username) {
        String normalized = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        CommunityProfile profile = profileMapper.findByUsername(normalized);
        if (profile != null) {
            return profile;
        }
        var history = usernameHistoryMapper.findByUsername(normalized);
        if (history == null) {
            return null;
        }
        return profileMapper.findByUserId(history.getUserId());
    }

    private List<SpaceWorksView.WorkSummary> listPublishedWorks(
            String spaceId, String categorySlug, boolean isOwner, int limit) {
        String categoryId = null;
        if (categorySlug != null && !categorySlug.isBlank()) {
            CreationSpaceCategory category = categoryMapper.findBySpaceIdAndSlug(spaceId, categorySlug);
            if (category == null) {
                return List.of();
            }
            categoryId = category.getId();
        }

        List<PublishedRevision> published;
        try {
            published = publishedRevisionMapper.listPublicBySpaceId(spaceId, limit);
        } catch (Exception ex) {
            return List.of();
        }
        List<SpaceWorksView.WorkSummary> works = new java.util.ArrayList<>();
        for (PublishedRevision revisionPointer : published) {
            Article article = articleMapper.selectById(revisionPointer.getArticleId());
            if (article == null) {
                continue;
            }
            if (categoryId != null && !categoryId.equals(article.getCategoryId())) {
                continue;
            }
            FormalRevision revision = formalRevisionMapper.selectById(revisionPointer.getFormalRevisionId());
            if (revision == null) {
                continue;
            }
            if ("PRIVATE".equals(revision.getVisibility()) && !isOwner) {
                continue;
            }
            String resolvedCategorySlug = null;
            if (article.getCategoryId() != null) {
                CreationSpaceCategory category = categoryMapper.selectById(article.getCategoryId());
                if (category != null) {
                    resolvedCategorySlug = category.getSlug();
                }
            }
            works.add(SpaceWorksView.WorkSummary.builder()
                    .id(article.getId())
                    .title(revision.getTitle())
                    .categorySlug(resolvedCategorySlug)
                    .build());
        }
        return works;
    }
}
