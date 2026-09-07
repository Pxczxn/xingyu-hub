package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("creator_follow")
public class CreatorFollow {
    @TableId
    private String id;
    private String followerId;
    private String creatorId;
    private Instant createdAt;
}
