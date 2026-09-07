package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ProfileView {
    String username;
    String displayName;
    String bio;
    String websiteUrl;
    String visibility;
    String followersVisibility;
    long lockVersion;
    String usernameChangedAt;
    long followerCount;
    long followingCount;
}
