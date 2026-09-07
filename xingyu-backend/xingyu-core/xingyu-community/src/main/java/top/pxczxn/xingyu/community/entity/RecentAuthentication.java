package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("recent_authentication")
public class RecentAuthentication {
    @TableId
    private String id;
    private String userId;
    private String sessionId;
    private Instant verifiedAt;
    private Instant expiresAt;
}
