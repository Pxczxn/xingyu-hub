package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.common.contract.access.AccessPolicy;
import top.pxczxn.xingyu.common.contract.access.AccessorContext;
import top.pxczxn.xingyu.common.contract.access.ResourceAccess;
import top.pxczxn.xingyu.common.contract.access.Visibility;
import top.pxczxn.xingyu.common.contract.ObjectId;
import top.pxczxn.xingyu.community.dto.ProfileView;
import top.pxczxn.xingyu.community.dto.PublicUserView;
import top.pxczxn.xingyu.community.dto.UserDetailView;
import top.pxczxn.xingyu.community.dto.MomentView;
import top.pxczxn.xingyu.community.dto.PageResultView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UsernameHistory;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityCreationSpaceMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.mapper.ReservedWordMapper;
import top.pxczxn.xingyu.community.mapper.UsernameHistoryMapper;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class CommunityProfileService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[a-z0-9_]{3,32}$");
    private static final int USERNAME_COOLDOWN_DAYS = 30;

    private final CommunityProfileMapper profileMapper;
    private final CommunityCreationSpaceMapper spaceMapper;
    private final ArticleMapper articleMapper;
    private final SeriesMapper seriesMapper;
    private final MomentMapper momentMapper;
    private final MomentService momentService;
    private final UsernameHistoryMapper usernameHistoryMapper;
    private final ReservedWordMapper reservedWordMapper;
    private final UserFollowMapper userFollowMapper;

    public ProfileView getProfile(CommunityUser user) {
        CommunityProfile profile = requireProfile(user.getId());
        return toView(profile, user.getId());
    }

    @Transactional
    public ProfileView updateProfile(CommunityUser user, Map<String, Object> body) {
        CommunityProfile profile = requireProfile(user.getId());
        long expectedVersion = body.get("lockVersion") instanceof Number number
                ? number.longValue()
                : profile.getLockVersion() == null ? 0L : profile.getLockVersion();
        if (!expectedVersion(profile).matches(expectedVersion)) {
            throw new ContractException(ErrorCode.CONFLICT, "资料已被他人更新，请刷新后重试");
        }

        if (body.containsKey("displayName")) {
            profile.setDisplayName(trimToNull(body.get("displayName")));
        }
        if (body.containsKey("bio")) {
            profile.setBio(trimToNull(body.get("bio")));
        }
        if (body.containsKey("websiteUrl")) {
            profile.setWebsiteUrl(validateWebsiteUrl(body.get("websiteUrl")));
        }
        if (body.containsKey("visibility")) {
            profile.setVisibility(parseVisibility(body.get("visibility")));
        }
        if (body.containsKey("username")) {
            renameUsername(user, profile, String.valueOf(body.get("username")));
        }

        profile.setLockVersion(expectedVersion + 1);
        profileMapper.updateById(profile);
        return toView(profile, user.getId());
    }

    @Transactional
    public ProfileView updatePrivacy(CommunityUser user, Map<String, String> body) {
        CommunityProfile profile = requireProfile(user.getId());
        if (body.containsKey("followersVisibility")) {
            String value = body.get("followersVisibility");
            if (!"PUBLIC".equals(value) && !"PRIVATE".equals(value)) {
                throw new FieldContractException("followersVisibility", "可见性值无效");
            }
            profile.setFollowersVisibility(value);
        }
        profile.setLockVersion(profile.getLockVersion() == null ? 1L : profile.getLockVersion() + 1);
        profileMapper.updateById(profile);
        return toView(profile, user.getId());
    }

    public UserDetailView getUserDetail(String rawUsername, CommunityUser viewer) {
        PublicUserView profile = getPublicProfile(rawUsername, viewer);
        CommunityProfile entity = resolveProfile(normalizeUsername(rawUsername));
        if (entity == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        CommunityCreationSpace space = spaceMapper.findByUserId(entity.getUserId());
        long articleCount = articleMapper.countPublishedByOwnerId(entity.getUserId());
        long seriesCount = seriesMapper.listByOwnerId(entity.getUserId()).stream()
                .filter(series -> "ACTIVE".equals(series.getStatus()))
                .count();
        long momentCount = momentMapper.countPublishedByAuthorId(entity.getUserId());
        return UserDetailView.builder()
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .avatar(ProfileSettingsSupport.resolveAvatar(entity))
                .bio(profile.getBio())
                .websiteUrl(profile.getWebsiteUrl())
                .visibility(profile.getVisibility())
                .owner(profile.isOwner())
                .following(profile.isFollowing())
                .followerCount(profile.getFollowerCount())
                .followingCount(profile.getFollowingCount())
                .canViewFollowLists(canViewFollowLists(entity, profile.isOwner()))
                .spaceSlug(space == null ? null : space.getSlug())
                .spaceDisplayName(space == null ? null : space.getDisplayName())
                .articleCount(articleCount)
                .seriesCount(seriesCount)
                .momentCount(momentCount)
                .build();
    }

    /**
     * Public moments of a profile, with the same visibility gate as the profile itself.
     *
     * <p>Lives here rather than in {@link MomentService} because the username → author id and
     * visibility rules already live here; the moment service only knows author ids. A missing
     * username and a private/unreadable profile both surface as NOT_FOUND from
     * {@link #getPublicProfile}, which is the same answer the profile page gives.
     */
    public PageResultView<MomentView> getPublicMoments(
            String rawUsername, CommunityUser viewer, int limit, String cursor) {
        PublicUserView publicProfile = getPublicProfile(rawUsername, viewer);
        CommunityProfile profile = resolveProfile(normalizeUsername(publicProfile.getUsername()));
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return momentService.listPublishedByAuthor(
                profile.getUserId(), limit, cursor, viewer == null ? null : viewer.getId());
    }

    public PublicUserView getPublicProfile(String rawUsername, CommunityUser viewer) {
        String username = normalizeUsername(rawUsername);
        CommunityProfile profile = resolveProfile(username);
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        boolean isOwner = viewer != null && viewer.getId().equals(profile.getUserId());
        requireVisibleProfile(profile, viewer);

        return PublicUserView.builder()
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .avatar(ProfileSettingsSupport.resolveAvatar(profile))
                .bio(profile.getBio())
                .websiteUrl(sanitizePublicUrl(profile.getWebsiteUrl()))
                .visibility(profile.getVisibility())
                .owner(isOwner)
                .following(viewer != null
                        && !isOwner
                        && userFollowMapper.findByFollowerAndFollowee(viewer.getId(), profile.getUserId()) != null)
                .followerCount(userFollowMapper.countFollowers(profile.getUserId()))
                .followingCount(userFollowMapper.countFollowing(profile.getUserId()))
                .build();
    }

    /**
     * Username-addressed form of {@link #requireVisibleProfile(CommunityProfile, CommunityUser)}.
     *
     * <p>Controllers and services that expose a profile surface (works, followers, space) use this
     * before reading anything, so the visibility rule has one implementation instead of one copy
     * per endpoint.
     */
    public void requireVisibleProfile(String rawUsername, CommunityUser viewer) {
        CommunityProfile profile = resolveProfile(normalizeUsername(rawUsername));
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        requireVisibleProfile(profile, viewer);
    }

    /**
     * Enforces the profile's stored visibility. PRIVATE means "only the owner"; UNLISTED is
     * readable through a direct link and PUBLIC is readable by anyone. A stranger gets 404, not
     * 403, so a hidden profile is indistinguishable from a missing one.
     */
    void requireVisibleProfile(CommunityProfile profile, CommunityUser viewer) {
        AccessorContext accessor = viewer == null
                ? AccessorContext.anonymous()
                : AccessorContext.authenticated(ObjectId.of(viewer.getId()));
        var decision = AccessPolicy.evaluate(
                ResourceAccess.builder()
                        .exists(true)
                        .ownerId(ObjectId.of(profile.getUserId()))
                        .visibility(Visibility.valueOf(profile.getVisibility()))
                        .ownerActive(true)
                        .resourceActive(true)
                        .build(),
                accessor);
        if (!decision.isAllowed()) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
    }

    private CommunityProfile resolveProfile(String username) {
        CommunityProfile profile = profileMapper.findByUsername(username);
        if (profile != null) {
            return profile;
        }
        UsernameHistory history = usernameHistoryMapper.findByUsername(username);
        if (history == null) {
            return null;
        }
        return profileMapper.findByUserId(history.getUserId());
    }

    private void renameUsername(CommunityUser user, CommunityProfile profile, String newUsernameRaw) {
        String newUsername = normalizeUsername(newUsernameRaw);
        if (newUsername.equals(profile.getUsername())) {
            return;
        }
        if (!USERNAME_PATTERN.matcher(newUsername).matches()) {
            throw new FieldContractException("username", "用户名格式无效");
        }
        if (profile.getUsernameChangedAt() != null
                && profile.getUsernameChangedAt().isAfter(Instant.now().minus(USERNAME_COOLDOWN_DAYS, ChronoUnit.DAYS))) {
            throw new FieldContractException("username", "改名冷却期内，请稍后再试");
        }
        if (profileMapper.findByUsername(newUsername) != null || usernameHistoryMapper.findByUsername(newUsername) != null) {
            throw new FieldContractException("username", "用户名已被占用");
        }
        if (reservedWordMapper.selectById(newUsername) != null) {
            throw new FieldContractException("username", "用户名不可用");
        }

        UsernameHistory history = new UsernameHistory();
        history.setId(TokenSupport.newId());
        history.setUserId(user.getId());
        history.setUsername(profile.getUsername());
        history.setCreatedAt(Instant.now());
        usernameHistoryMapper.insert(history);

        profile.setUsername(newUsername);
        profile.setUsernameChangedAt(Instant.now());

        CommunityCreationSpace space = spaceMapper.selectOne(new LambdaQueryWrapper<CommunityCreationSpace>()
                .eq(CommunityCreationSpace::getUserId, user.getId())
                .last("LIMIT 1"));
        if (space != null) {
            space.setSlug(newUsername);
            spaceMapper.updateById(space);
        }
    }

    private CommunityProfile requireProfile(String userId) {
        CommunityProfile profile = profileMapper.findByUserId(userId);
        if (profile == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "资料不存在");
        }
        return profile;
    }

    private ProfileView toView(CommunityProfile profile, String userId) {
        return ProfileView.builder()
                .username(profile.getUsername())
                .displayName(profile.getDisplayName())
                .avatar(ProfileSettingsSupport.resolveAvatar(profile))
                .bio(profile.getBio())
                .websiteUrl(profile.getWebsiteUrl())
                .visibility(profile.getVisibility())
                .followersVisibility(profile.getFollowersVisibility() == null ? "PRIVATE" : profile.getFollowersVisibility())
                .lockVersion(profile.getLockVersion() == null ? 0L : profile.getLockVersion())
                .usernameChangedAt(profile.getUsernameChangedAt() == null ? null : profile.getUsernameChangedAt().toString())
                .followerCount(userFollowMapper.countFollowers(userId))
                .followingCount(userFollowMapper.countFollowing(userId))
                .build();
    }

    private static top.pxczxn.xingyu.common.contract.concurrency.LockVersion expectedVersion(CommunityProfile profile) {
        return top.pxczxn.xingyu.common.contract.concurrency.LockVersion.builder()
                .value(profile.getLockVersion() == null ? 0L : profile.getLockVersion())
                .build();
    }

    private static String normalizeUsername(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }

    private static String parseVisibility(Object raw) {
        String value = raw == null ? "PRIVATE" : raw.toString().trim().toUpperCase(Locale.ROOT);
        if (!"PUBLIC".equals(value) && !"PRIVATE".equals(value) && !"UNLISTED".equals(value)) {
            throw new FieldContractException("visibility", "可见性值无效");
        }
        return value;
    }

    private static String validateWebsiteUrl(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.toString().trim();
        if (value.isEmpty()) {
            return null;
        }
        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException ex) {
            throw new FieldContractException("websiteUrl", "链接格式无效");
        }
        String scheme = uri.getScheme();
        if (scheme == null || (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme))) {
            throw new FieldContractException("websiteUrl", "仅支持 http/https 链接");
        }
        return value;
    }

    private static String sanitizePublicUrl(String url) {
        return validateWebsiteUrl(url);
    }

    private static String trimToNull(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.toString().trim();
        return value.isEmpty() ? null : value;
    }

    private static boolean canViewFollowLists(CommunityProfile profile, boolean isOwner) {
        if (isOwner) {
            return true;
        }
        String visibility = profile.getFollowersVisibility();
        return visibility == null || "PUBLIC".equalsIgnoreCase(visibility);
    }
}
