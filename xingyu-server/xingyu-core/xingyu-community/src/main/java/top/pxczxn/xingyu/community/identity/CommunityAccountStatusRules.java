package top.pxczxn.xingyu.community.identity;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.entity.CommunityUser;

/**
 * 社区账号能否登录的状态规则。与 {@code CommunityAccountService.login} 使用同一套判定。
 */
public final class CommunityAccountStatusRules {

    public static final String ACTIVE = "ACTIVE";
    public static final String PENDING_REVIEW = "PENDING_REVIEW";
    public static final String REJECTED = "REJECTED";
    public static final String SUSPENDED = "SUSPENDED";

    private CommunityAccountStatusRules() {
    }

    public static CommunityLoginBlockReason evaluate(CommunityUser user, boolean requireEmailVerified) {
        if (user == null) {
            return CommunityLoginBlockReason.NOT_FOUND;
        }
        String status = user.getStatus();
        if (!ACTIVE.equals(status)) {
            if (PENDING_REVIEW.equals(status)) {
                return CommunityLoginBlockReason.PENDING_REVIEW;
            }
            if (REJECTED.equals(status)) {
                return CommunityLoginBlockReason.REJECTED;
            }
            return CommunityLoginBlockReason.SUSPENDED;
        }
        if (requireEmailVerified && user.getEmailVerifiedAt() == null) {
            return CommunityLoginBlockReason.EMAIL_UNVERIFIED;
        }
        return CommunityLoginBlockReason.NONE;
    }

    public static CommunityLoginReadiness readiness(CommunityUser user, boolean requireEmailVerified) {
        CommunityLoginBlockReason reason = evaluate(user, requireEmailVerified);
        if (reason == CommunityLoginBlockReason.NONE) {
            return CommunityLoginReadiness.ok();
        }
        return CommunityLoginReadiness.blocked(reason);
    }

    public static void throwIfCannotLogin(CommunityUser user, boolean requireEmailVerified) {
        switch (evaluate(user, requireEmailVerified)) {
            case PENDING_REVIEW -> throw new ContractException(
                    ErrorCode.AUTH_FORBIDDEN, "账号正在审核中，请等待管理员审核通过后再登录");
            case REJECTED -> throw new ContractException(
                    ErrorCode.AUTH_FORBIDDEN, "注册申请未通过审核，如有疑问请联系管理员");
            case SUSPENDED -> throw new ContractException(ErrorCode.ACCOUNT_SUSPENDED);
            case EMAIL_UNVERIFIED -> throw new ContractException(
                    ErrorCode.AUTH_FORBIDDEN, "请先完成邮箱验证后再登录");
            case NOT_FOUND, NONE -> {
                // 登录路径在密码校验处把「找不到用户」当成凭证错误，这里不抛。
            }
        }
    }
}
