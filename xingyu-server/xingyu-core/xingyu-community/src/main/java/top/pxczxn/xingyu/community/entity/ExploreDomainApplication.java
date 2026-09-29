package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("explore_domain_application")
public class ExploreDomainApplication {
    @TableId
    private String id;
    private String userId;
    private String proposedName;
    private String description;
    private String status;
    private java.time.Instant createdAt;
}
