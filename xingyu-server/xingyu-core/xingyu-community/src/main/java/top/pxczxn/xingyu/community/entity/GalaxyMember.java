package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("galaxy_member")
public class GalaxyMember {
    @TableId
    private String id;
    private String galaxyId;
    private String userId;
    private String role;
    private Instant joinedAt;
}
