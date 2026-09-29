package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("explore_domain")
public class ExploreDomain {
    @TableId
    private String id;
    private String seedKey;
    private String slug;
    private String name;
    private String description;
    private String icon;
    private String parentId;
    private String domainType;
    private String ownerUserId;
    private String status;
    private Integer sortOrder;
    private Instant createdAt;
}
