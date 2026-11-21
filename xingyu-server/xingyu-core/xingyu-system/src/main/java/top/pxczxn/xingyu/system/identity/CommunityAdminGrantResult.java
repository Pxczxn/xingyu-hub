package top.pxczxn.xingyu.system.identity;

/**
 * 社区管理员授权结果。只返回 UUID，不含邮箱或口令。
 */
public record CommunityAdminGrantResult(String communityUserId, boolean alreadyGranted) {
}
