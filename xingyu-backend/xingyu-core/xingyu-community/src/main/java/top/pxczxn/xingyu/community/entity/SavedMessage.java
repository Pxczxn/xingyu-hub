package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("saved_message")
public class SavedMessage {
    @TableId
    private String id;
    private String userId;
    private String messageId;
    private String conversationId;
    private Instant createdAt;
}
