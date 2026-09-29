package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class ConversationView {
    String id;
    String type;
    String title;
    Instant updatedAt;
    String lastMessage;
    Long unreadCount;
    String announcement;
    Instant announcementUpdatedAt;
    String joinMode;
    String myRole;
    List<ChatMessageView> messages;
}
