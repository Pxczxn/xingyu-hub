package top.pxczxn.xingyu.community.identity;

import java.util.Optional;

/**
 * 社区身份认证前置层。管理端日常登录经 {@code AdminConsoleIdentityPort} 接入本服务。
 *
 * <p>密码比对复用 {@code PasswordSupport}（BCrypt）。不读写 Redis 登录失败锁。
 */
public interface CommunityIdentityService {

    Optional<CommunityIdentityView> findById(String communityUserId);

    Optional<CommunityIdentityView> findByLogin(String login);

    CommunityLoginReadiness evaluateLoginReadiness(String communityUserId);

    AdminConsoleEligibility evaluateAdminConsoleEligibility(String communityUserId);

    boolean passwordMatches(String communityUserId, String rawPassword);

    void replacePassword(String communityUserId, String rawNewPassword);

    void updateAdminProfile(
            String communityUserId,
            String displayName,
            String avatar,
            String email,
            String phone);

    String resolveDisplayName(String communityUserId);
}
