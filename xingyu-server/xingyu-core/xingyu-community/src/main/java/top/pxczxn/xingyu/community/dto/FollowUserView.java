package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class FollowUserView {
    String userId;
    String username;
    String displayName;
    Instant followedAt;
}
