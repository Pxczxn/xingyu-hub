package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("moderation_case")
public class ModerationCase {
    @TableId
    private String id;
    private String reportId;
    private String status;
    private String assignedTo;
    private Instant createdAt;
    private Instant updatedAt;
}
