package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("notification")
public class Notification {
    @TableId
    private String id;
    private String userId;
    private String category;
    private String title;
    private String body;
    private Instant readAt;
    private Instant createdAt;
}
