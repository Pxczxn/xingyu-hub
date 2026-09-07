package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("galaxy_join_request")
public class GalaxyJoinRequest {
    @TableId
    private String id;
    private String galaxyId;
    private String userId;
    private String message;
    private String status;
    private Instant createdAt;
    private Instant resolvedAt;
}
