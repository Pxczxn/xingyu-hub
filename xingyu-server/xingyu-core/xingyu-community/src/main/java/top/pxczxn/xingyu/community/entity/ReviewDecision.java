package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("review_decision")
public class ReviewDecision {
    @TableId
    private String id;
    private String submissionId;
    private String decision;
    private String decidedBy;
    private String comment;
    private Instant decidedAt;
}
