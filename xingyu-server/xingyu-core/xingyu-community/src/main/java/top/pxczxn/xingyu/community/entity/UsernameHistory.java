package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("username_history")
public class UsernameHistory {
    @TableId
    private String id;
    private String userId;
    private String username;
    private Instant createdAt;
}
