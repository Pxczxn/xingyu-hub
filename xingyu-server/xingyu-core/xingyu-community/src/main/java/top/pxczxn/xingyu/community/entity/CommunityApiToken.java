package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_api_token")
public class CommunityApiToken {
    @TableId
    private String id;
    private String userId;
    private String name;
    private String tokenPrefix;
    private String tokenHash;
    private String scopes;
    private String status;
    private Instant lastUsedAt;
    private Instant createdAt;
    private Instant revokedAt;
}
