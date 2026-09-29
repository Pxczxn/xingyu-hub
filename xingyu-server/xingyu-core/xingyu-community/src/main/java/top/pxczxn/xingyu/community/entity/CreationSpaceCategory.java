package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("creation_space_category")
public class CreationSpaceCategory {
    @TableId
    private String id;
    private String spaceId;
    private String name;
    private String slug;
    private String status;
    private Long lockVersion;
    private Integer sortOrder;
    private Instant createdAt;
}
