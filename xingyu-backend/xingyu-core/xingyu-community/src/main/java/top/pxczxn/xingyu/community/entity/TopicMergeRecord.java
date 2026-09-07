package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("topic_merge_record")
public class TopicMergeRecord {
    @TableId
    private String id;
    private String sourceTopicId;
    private String targetTopicId;
    private String operatorId;
    private Instant mergedAt;
}
