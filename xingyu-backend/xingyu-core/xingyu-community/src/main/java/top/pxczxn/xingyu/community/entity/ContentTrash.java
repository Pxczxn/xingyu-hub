package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("content_trash")
public class ContentTrash {
    @TableId
    private String id;
    private String objectType;
    private String objectId;
    private String ownerId;
    private Instant trashedAt;
}
