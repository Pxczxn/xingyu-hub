package top.pxczxn.xingyu.community.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.Instant;

/**
 * 近期再认证记录。
 *
 * <p>{@code consumedAt}（V049 新增）：非空表示这个 grant 已经被<b>一次性</b>的高风险操作
 * 消费掉了。为 NULL 表示还没用过。语义与 {@code email_verification_token.consumed_at} 一致。
 *
 * <p>为什么要有它：grant 只有 15 分钟窗口且绑定 userId + sessionId，但此前<b>可在窗口内反复使用</b>。
 * 邮箱换绑重复使用只是重发一封确认信（幂等），停用账号则不可逆 ——
 * 一个被抄走的 grant id 就能被反复触发。
 */
@Data
@TableName("recent_authentication")
public class RecentAuthentication {
    @TableId
    private String id;
    private String userId;
    private String sessionId;
    private Instant verifiedAt;
    private Instant expiresAt;
    private Instant consumedAt;
}
