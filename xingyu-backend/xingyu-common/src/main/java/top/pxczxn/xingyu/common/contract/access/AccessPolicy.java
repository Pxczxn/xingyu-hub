package top.pxczxn.xingyu.common.contract.access;

import top.pxczxn.xingyu.common.contract.ErrorCode;

/**
 * 固定顺序：存在性 → 主体 → 生命周期 → 权限 → 发现资格。
 */
public final class AccessPolicy {

    private AccessPolicy() {
    }

    public static AccessDecision evaluate(ResourceAccess resource, AccessorContext accessor) {
        if (!resource.isExists()) {
            return AccessDecision.deny(ErrorCode.NOT_FOUND);
        }
        if (!resource.isOwnerActive()) {
            return AccessDecision.deny(ErrorCode.NOT_FOUND);
        }
        if (!resource.isResourceActive() || resource.isGovernanceSuppressed()) {
            return AccessDecision.deny(ErrorCode.NOT_FOUND);
        }
        if (resource.isUnderReview() && !accessor.isOwner(resource.getOwnerId())) {
            return AccessDecision.deny(ErrorCode.NOT_FOUND);
        }

        Visibility visibility = resource.getVisibility();
        if (visibility == Visibility.PRIVATE && !accessor.isOwner(resource.getOwnerId())) {
            return AccessDecision.deny(ErrorCode.NOT_FOUND);
        }
        if (visibility == Visibility.UNLISTED && !accessor.isOwner(resource.getOwnerId())) {
            return AccessDecision.allow(false);
        }
        return AccessDecision.allow(visibility == Visibility.PUBLIC);
    }
}
