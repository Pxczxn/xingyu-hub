package top.pxczxn.xingyu.community.dto;

public record InsightsView(
        long articleCount,
        long draftCount,
        long followerCount,
        long followingCount,
        long commentCount,
        long likeCount
) {}
