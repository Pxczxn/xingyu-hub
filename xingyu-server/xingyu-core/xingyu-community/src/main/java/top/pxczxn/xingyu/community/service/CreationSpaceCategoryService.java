package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.CategoryView;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.CreationSpaceCategory;
import top.pxczxn.xingyu.community.mapper.CreationSpaceCategoryMapper;
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
public class CreationSpaceCategoryService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z0-9-]{2,64}$");

    private final CreationSpaceService spaceService;
    private final CreationSpaceCategoryMapper categoryMapper;

    public List<CategoryView> listForOwner(CommunityUser user) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        return categoryMapper.listBySpaceId(space.getId()).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional
    public CategoryView create(CommunityUser user, String name, String slug) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        String normalizedSlug = normalizeSlug(slug == null || slug.isBlank() ? name : slug);
        validateSlug(normalizedSlug);
        String trimmedName = name == null ? "" : name.trim();
        if (trimmedName.isBlank()) {
            throw new FieldContractException("name", "分类名称不能为空");
        }
        if (categoryMapper.findBySpaceIdAndSlug(space.getId(), normalizedSlug) != null) {
            throw new FieldContractException("slug", "别名已被占用");
        }
        CreationSpaceCategory category = new CreationSpaceCategory();
        category.setId(TokenSupport.newId());
        category.setSpaceId(space.getId());
        category.setName(trimmedName);
        category.setSlug(normalizedSlug);
        category.setStatus("ACTIVE");
        category.setLockVersion(0L);
        category.setSortOrder(0);
        category.setCreatedAt(Instant.now());
        categoryMapper.insert(category);
        return toView(category);
    }

    @Transactional
    public CategoryView update(CommunityUser user, String categoryId, Map<String, Object> body) {
        CreationSpaceCategory category = requireOwnedCategory(user, categoryId);
        long expected = body.get("lockVersion") instanceof Number n
                ? n.longValue()
                : category.getLockVersion() == null ? 0L : category.getLockVersion();
        if (category.getLockVersion() == null ? expected != 0L : category.getLockVersion() != expected) {
            throw new ContractException(ErrorCode.CONFLICT, "分类已被他人更新");
        }
        if (body.containsKey("name")) {
            String name = String.valueOf(body.get("name")).trim();
            if (name.isBlank()) {
                throw new FieldContractException("name", "分类名称不能为空");
            }
            category.setName(name);
        }
        if (body.containsKey("status")) {
            String status = String.valueOf(body.get("status")).trim().toUpperCase(Locale.ROOT);
            if (!"ACTIVE".equals(status) && !"ARCHIVED".equals(status)) {
                throw new FieldContractException("status", "状态值无效");
            }
            category.setStatus(status);
        }
        category.setLockVersion(expected + 1);
        categoryMapper.updateById(category);
        return toView(category);
    }

    @Transactional
    public void delete(CommunityUser user, String categoryId) {
        CreationSpaceCategory category = requireOwnedCategory(user, categoryId);
        categoryMapper.deleteById(category.getId());
    }

    private CreationSpaceCategory requireOwnedCategory(CommunityUser user, String categoryId) {
        CommunityCreationSpace space = spaceService.requireSpaceForUser(user);
        CreationSpaceCategory category = categoryMapper.selectById(categoryId);
        if (category == null || !space.getId().equals(category.getSpaceId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return category;
    }

    private CategoryView toView(CreationSpaceCategory category) {
        return CategoryView.builder()
                .id(category.getId())
                .name(category.getName())
                .slug(category.getSlug())
                .status(category.getStatus())
                .lockVersion(category.getLockVersion() == null ? 0L : category.getLockVersion())
                .sortOrder(category.getSortOrder() == null ? 0 : category.getSortOrder())
                .build();
    }

    private static void validateSlug(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new FieldContractException("slug", "别名格式无效");
        }
    }

    private static String normalizeSlug(String slug) {
        return slug == null ? "" : slug.trim().toLowerCase(Locale.ROOT).replace(' ', '-');
    }
}
