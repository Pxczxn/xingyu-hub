package top.pxczxn.xingyu.community.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record BlockedUserView(
        String userId,
        String username,
        String displayName,
        Instant blockedAt) {
}
