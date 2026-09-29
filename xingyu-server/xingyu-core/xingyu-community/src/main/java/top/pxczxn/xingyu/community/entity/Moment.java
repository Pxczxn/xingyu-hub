package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("moment")
public class Moment {
    @TableId
    private String id;
    private String authorId;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;
}
