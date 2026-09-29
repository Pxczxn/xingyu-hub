package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record GroupJoinRequestView(
        String id,
        String conversationId,
        String userId,
        String username,
        String displayName,
        String message,
        String status,
        Instant createdAt
) {}
