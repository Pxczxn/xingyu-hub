package top.pxczxn.xingyu.community.identity;

import java.util.List;

public record AdminConsoleEligibility(
        boolean eligible,
        CommunityLoginReadiness loginReadiness,
        List<String> staffRoleCodes) {
}
