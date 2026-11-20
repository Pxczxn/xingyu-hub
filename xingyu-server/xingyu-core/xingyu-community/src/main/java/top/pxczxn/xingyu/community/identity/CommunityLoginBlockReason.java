package top.pxczxn.xingyu.community.identity;

/**
 * 与 {@code CommunityAccountService.login} 账号状态闸门对齐的拒绝原因。
 *
 * <p>不含 Redis 登录失败锁定：该锁按规范化登录名计数，不属于按 UUID 的身份判断。
 */
public enum CommunityLoginBlockReason {
    NONE,
    NOT_FOUND,
    PENDING_REVIEW,
    REJECTED,
    SUSPENDED,
    EMAIL_UNVERIFIED
}
