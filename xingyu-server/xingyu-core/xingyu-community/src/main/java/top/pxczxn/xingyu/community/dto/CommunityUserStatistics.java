package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 社区用户全局概览统计。
 * attention = REJECTED + SUSPENDED，且数值不跟随列表的分页/筛选条件变化。
 */
@Value
@Builder
public class CommunityUserStatistics {
    long totalUsers;
    long pendingReview;
    long active;
    long attention;

    public static CommunityUserStatistics of(long totalUsers, long pendingReview, long active, long attention) {
        return CommunityUserStatistics.builder()
                .totalUsers(totalUsers)
                .pendingReview(pendingReview)
                .active(active)
                .attention(attention)
                .build();
    }
}
