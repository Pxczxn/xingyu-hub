package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("chat_message")
public class ChatMessage {
    @TableId
    private String id;
    private String conversationId;
    private String senderId;
    private Long sequenceNumber;
    private String body;
    private String messageType;
    private String attachmentUrl;
    private String attachmentName;
    private String clientMessageId;
    private Instant createdAt;
    private Instant recalledAt;
}
