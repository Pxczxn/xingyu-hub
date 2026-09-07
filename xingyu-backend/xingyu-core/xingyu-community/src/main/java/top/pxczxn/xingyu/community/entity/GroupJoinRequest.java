package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("group_join_request")
public class GroupJoinRequest {
    @TableId
    private String id;
    private String conversationId;
    private String userId;
    private String message;
    private String status;
    private Instant createdAt;
    private Instant resolvedAt;
    private String resolvedBy;
}
