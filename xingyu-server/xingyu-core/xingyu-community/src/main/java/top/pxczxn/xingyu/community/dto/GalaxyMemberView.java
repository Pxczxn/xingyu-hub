package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class GalaxyMemberView {
    String userId;
    String username;
    String displayName;
    String role;
    Instant joinedAt;
}
