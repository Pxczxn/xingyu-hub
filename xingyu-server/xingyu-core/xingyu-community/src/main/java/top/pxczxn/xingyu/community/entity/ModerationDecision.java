package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("moderation_decision")
public class ModerationDecision {
    @TableId
    private String id;
    private String caseId;
    private String decision;
    private String decidedBy;
    private String comment;
    private Instant decidedAt;
}
