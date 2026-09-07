package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("email_verification_token")
public class EmailVerificationToken {
    @TableId
    private String id;
    private String userId;
    private String tokenHash;
    private String purpose;
    private String newEmail;
    private Instant expiresAt;
    private Instant consumedAt;
    private Instant createdAt;
}
