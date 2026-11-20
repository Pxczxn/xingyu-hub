package top.pxczxn.xingyu.system.identity;

/**
 * 管理端登录可用的社区身份摘要。不含密码哈希。
 */
public record AdminConsolePrincipal(
        String id,
        String loginName,
        String displayName,
        String avatar) {
}
