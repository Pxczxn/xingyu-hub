package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

@Data
@TableName("collaboration_invite")
public class CollaborationInvite {
    @TableId
    private String id;
    private String inviterId;
    private String token;
    private String note;
    private Instant expiresAt;
    private Instant createdAt;
}
