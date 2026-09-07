package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("guide_page")
public class GuidePage {
    @TableId
    private String id;
    private String slug;
    private String title;
    private String body;
    private Integer sortOrder;
    private String status;
    private Instant publishedAt;
    private Instant createdAt;
}
