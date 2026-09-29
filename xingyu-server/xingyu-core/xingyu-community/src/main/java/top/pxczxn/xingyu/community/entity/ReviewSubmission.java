package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("review_submission")
public class ReviewSubmission {
    @TableId
    private String id;
    private String articleId;
    private String formalRevisionId;
    private String submittedBy;
    private String status;
    private Instant submittedAt;
}
