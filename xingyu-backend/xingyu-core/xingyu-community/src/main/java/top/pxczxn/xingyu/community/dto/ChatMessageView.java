package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ChatMessageView {
    String id;
    String conversationId;
    String conversationType;
    String senderId;
    long sequenceNumber;
    String body;
    String messageType;
    String attachmentUrl;
    String attachmentName;
    Instant createdAt;
    Instant recalledAt;
}
