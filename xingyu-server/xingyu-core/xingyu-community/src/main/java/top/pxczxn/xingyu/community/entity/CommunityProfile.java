package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_profile")
public class CommunityProfile {
    @TableId
    private String id;
    private String userId;
    private String username;
    private String displayName;
    private String bio;
    private String websiteUrl;
    private String visibility;
    private String followersVisibility;
    private Long lockVersion;
    private Instant usernameChangedAt;
    private String settingsJson;
    private Instant createdAt;
}
