package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("topic_alias")
public class TopicAlias {
    @TableId
    private String id;
    private String topicId;
    private String aliasSlug;
    private Instant createdAt;
}
