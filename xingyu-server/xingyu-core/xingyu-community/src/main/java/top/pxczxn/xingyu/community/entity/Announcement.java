package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("announcement")
public class Announcement {
    @TableId
    private String id;
    private String title;
    private String body;
    private String status;
    private Instant publishedAt;
    private Instant createdAt;
}
