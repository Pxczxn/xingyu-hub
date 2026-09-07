package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_user")
public class CommunityUser {
    @TableId
    private String id;
    private String email;
    private String phone;
    private String passwordHash;
    private Instant emailVerifiedAt;
    private Instant phoneVerifiedAt;
    private String status;
    private String role;
    private String termsVersion;
    private Instant createdAt;
}
