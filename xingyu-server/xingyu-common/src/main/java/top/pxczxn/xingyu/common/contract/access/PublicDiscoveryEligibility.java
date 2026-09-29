package top.pxczxn.xingyu.common.contract.access;

/**
 * 公共发现资格：搜索、发现、推荐、RSS、Sitemap 的共同门槛。
 * 在读取资格之上额外要求可发现、已发布、无治理限制。
 */
public final class PublicDiscoveryEligibility {

    private PublicDiscoveryEligibility() {
    }

    public static boolean isEligible(DiscoverableResource resource, AccessorContext accessor) {
        AccessDecision read = AccessPolicy.evaluate(resource.toResourceAccess(), accessor);
        if (!read.isAllowed()) {
            return false;
        }
        if (!resource.isHasPublishedRevision()) {
            return false;
        }
        if (resource.isGovernanceSuppressed()) {
            return false;
        }
        if (!resource.isDiscoveryEligible()) {
            return false;
        }
        return read.isDiscoverable();
    }
}
