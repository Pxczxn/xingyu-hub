package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("content_like")
public class ContentLike {
    @TableId
    private String id;
    private String userId;
    private String objectType;
    private String objectId;
    private Instant createdAt;
}
