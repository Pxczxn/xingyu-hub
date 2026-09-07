package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record MyGroupJoinRequestView(
        String id,
        String conversationId,
        String conversationTitle,
        String joinMode,
        String message,
        String status,
        Instant createdAt,
        Instant resolvedAt
) {}
