package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("moderation_measure")
public class ModerationMeasure {
    @TableId
    private String id;
    private String decisionId;
    private String measureType;
    private String targetType;
    private String targetId;
    private Instant expiresAt;
    private Instant createdAt;
}
