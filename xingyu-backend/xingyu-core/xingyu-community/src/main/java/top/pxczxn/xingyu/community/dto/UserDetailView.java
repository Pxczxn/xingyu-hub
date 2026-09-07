package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserDetailView {
    String username;
    String displayName;
    String bio;
    String websiteUrl;
    String visibility;
    boolean owner;
    boolean following;
    long followerCount;
    long followingCount;
    String spaceSlug;
    String spaceDisplayName;
    long articleCount;
    long seriesCount;
}
