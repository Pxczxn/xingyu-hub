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
    /**
     * 触发该通知的稳定用户标识（community_user.id），当前仅 FOLLOW 写入（= 发起关注的人）。
     *
     * <p>刻意不存 username：username 可改。读取时按本字段现查 community_profile 得到当前
     * canonical username，历史通知因此不会因发起者改名而失效。可空 —— 系统类/历史类通知没有 actor。
     */
    private String actorUserId;
    private String category;
    private String title;
    private String body;
    private Instant readAt;
    private Instant createdAt;
}
