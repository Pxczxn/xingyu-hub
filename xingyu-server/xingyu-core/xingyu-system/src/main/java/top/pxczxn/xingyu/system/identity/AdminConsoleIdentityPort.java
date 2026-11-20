package top.pxczxn.xingyu.system.identity;

import java.util.Optional;

/**
 * 管理端认证对社区身份的只读端口。实现位于 community 模块，避免 system/auth 反向依赖。
 */
public interface AdminConsoleIdentityPort {

    Optional<AdminConsolePrincipal> lookupByLogin(String login);

    Optional<AdminConsolePrincipal> lookupById(String communityUserId);

    boolean passwordMatches(String communityUserId, String rawPassword);

    boolean canLogin(String communityUserId);

    String loginBlockedMessage(String communityUserId);

    boolean canAccessAdminConsole(String communityUserId);

    void requireActive(String communityUserId);
}
