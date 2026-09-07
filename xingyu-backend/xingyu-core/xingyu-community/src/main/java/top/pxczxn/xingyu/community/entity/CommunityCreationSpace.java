package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("community_creation_space")
public class CommunityCreationSpace {
    @TableId
    private String id;
    private String userId;
    private String slug;
    private String displayName;
    private String description;
    private Instant createdAt;
}
