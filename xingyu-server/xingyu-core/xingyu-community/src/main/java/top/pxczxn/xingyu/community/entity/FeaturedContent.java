package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("featured_content")
public class FeaturedContent {
    @TableId
    private String id;
    private String objectType;
    private String objectId;
    private Integer sortOrder;
    private String status;
    private Instant createdAt;
}
