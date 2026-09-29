package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_session")
public class CommunitySession {
    @TableId
    private String id;
    private String userId;
    private String tokenValue;
    private String deviceLabel;
    private String userAgent;
    private String ipHash;
    private Instant lastActiveAt;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt;
}
