package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("conversation_member")
public class ConversationMember {
    @TableId
    private String id;
    private String conversationId;
    private String userId;
    private String role;
    private Long lastReadSequence;
    private Instant joinedAt;
}
