package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("user_follow")
public class UserFollow {
    @TableId
    private String id;
    private String followerId;
    private String followeeId;
    private Instant createdAt;
}
