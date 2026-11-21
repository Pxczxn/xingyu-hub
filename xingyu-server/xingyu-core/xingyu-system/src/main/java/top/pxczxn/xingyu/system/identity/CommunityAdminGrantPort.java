package top.pxczxn.xingyu.system.identity;

/**
 * 把已有社区账号授予管理端 {@code admin} 角色。实现位于 community 模块。
 *
 * <p>不创建账号，不改密码或资料。日常认证仍以 {@code community_user} UUID 为准。
 */
public interface CommunityAdminGrantPort {

    CommunityAdminGrantResult grantExistingByEmail(String email);
}
