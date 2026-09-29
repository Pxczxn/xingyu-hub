package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("user_explore_domain")
public class UserExploreDomain {
    @TableId
    private String id;
    private String userId;
    private String domainId;
    private Integer sortOrder;
    private Instant createdAt;
}
