package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("collection")
public class UserCollection {
    @TableId
    private String id;
    private String ownerId;
    private String name;
    private String visibility;
    private Instant createdAt;
    private Instant updatedAt;
}
