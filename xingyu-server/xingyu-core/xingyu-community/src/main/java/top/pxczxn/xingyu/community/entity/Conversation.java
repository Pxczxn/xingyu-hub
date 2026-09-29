package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("conversation")
public class Conversation {
    @TableId
    private String id;
    private String type;
    private String title;
    private String announcement;
    private Instant announcementUpdatedAt;
    private String joinMode;
    private Instant createdAt;
    private Instant updatedAt;
}
