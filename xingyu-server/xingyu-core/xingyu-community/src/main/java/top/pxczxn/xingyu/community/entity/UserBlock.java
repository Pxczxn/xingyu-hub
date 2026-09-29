package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("user_block")
public class UserBlock {
    @TableId
    private String id;
    private String blockerId;
    private String blockedId;
    private Instant createdAt;
}
