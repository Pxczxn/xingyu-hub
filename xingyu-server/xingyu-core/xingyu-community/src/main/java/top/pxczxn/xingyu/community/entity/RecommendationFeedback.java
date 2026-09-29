package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("recommendation_feedback")
public class RecommendationFeedback {
    @TableId
    private String id;
    private String userId;
    private String body;
    private Instant createdAt;
}
