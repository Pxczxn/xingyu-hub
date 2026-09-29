package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("series")
public class Series {
    @TableId
    private String id;
    private String ownerId;
    private String spaceId;
    private String title;
    private String slug;
    private String description;
    private String status;
    private Long lockVersion;
    private Instant createdAt;
    private Instant updatedAt;
}
