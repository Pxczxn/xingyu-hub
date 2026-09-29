package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("galaxy_content")
public class GalaxyContent {
    @TableId
    private String id;
    private String galaxyId;
    private String objectType;
    private String objectId;
    private Boolean pinned;
    private Instant createdAt;
}
