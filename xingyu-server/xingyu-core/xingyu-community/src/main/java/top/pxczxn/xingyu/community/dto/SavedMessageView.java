package top.pxczxn.xingyu.community.dto;

import java.time.Instant;

public record SavedMessageView(
        String id,
        String messageId,
        String conversationId,
        String conversationType,
        String conversationTitle,
        String messageType,
        String body,
        String attachmentUrl,
        String attachmentName,
        String senderId,
        Instant messageCreatedAt,
        Instant savedAt
) {}
