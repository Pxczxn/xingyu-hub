package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("collaboration_member")
public class CollaborationMember {
    @TableId
    private String id;
    private String ownerId;
    private String memberId;
    private String role;
    private String inviteId;
    private Instant createdAt;
}
