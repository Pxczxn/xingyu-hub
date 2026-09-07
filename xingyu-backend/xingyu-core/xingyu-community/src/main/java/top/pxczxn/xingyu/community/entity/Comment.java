package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("comment")
public class Comment {
    @TableId
    private String id;
    private String objectType;
    private String objectId;
    private String authorId;
    private String parentId;
    private String body;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
