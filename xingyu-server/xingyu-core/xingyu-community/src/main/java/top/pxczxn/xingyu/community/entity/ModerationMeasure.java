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
    /** 隐藏前的内容状态。NULL 表示这条措施产生时还没有记录，申诉不得据此猜测。 */
    private String priorStatus;
    private Instant expiresAt;
    private Instant createdAt;
}
