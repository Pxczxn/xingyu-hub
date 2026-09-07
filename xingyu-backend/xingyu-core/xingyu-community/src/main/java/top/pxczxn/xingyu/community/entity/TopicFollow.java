package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("topic_follow")
public class TopicFollow {
    @TableId
    private String id;
    private String userId;
    private String topicId;
    private Instant createdAt;
}
