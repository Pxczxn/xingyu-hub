package top.pxczxn.xingyu.community.identity;

import java.util.Optional;

/**
 * 社区身份认证前置层。尚未接入管理端登录 Controller 或拦截器。
 *
 * <p>密码比对复用 {@code PasswordSupport}（BCrypt）。不读写 Redis 登录失败锁；
 * 真正登录仍须走 {@code CommunityAccountService.login}。
 */
public interface CommunityIdentityService {

    Optional<CommunityIdentityView> findById(String communityUserId);

    CommunityLoginReadiness evaluateLoginReadiness(String communityUserId);

    AdminConsoleEligibility evaluateAdminConsoleEligibility(String communityUserId);

    boolean passwordMatches(String communityUserId, String rawPassword);
}
