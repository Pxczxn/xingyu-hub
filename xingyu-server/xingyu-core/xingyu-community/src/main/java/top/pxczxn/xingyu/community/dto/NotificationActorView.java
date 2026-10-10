package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 通知的结构化 actor —— 触发这条通知的人。
 *
 * <p>存在的理由：历史通知只把名字拼进 title/body 文本，前端拿不到稳定身份，既无法跳到
 * 发起者主页，也无法在发起者改名后仍然定位。这里把「谁」结构化出来。
 *
 * <p>{@code userId} 是写入时就固定下来的稳定身份（{@code notification.actor_user_id}），
 * {@code username} / {@code displayName} 是**读取时**按 userId 现查 community_profile 得到的
 * 当前值 —— 所以改名后 username 会跟着变，旧的 user_id 不变，导航始终指向当前主页。
 *
 * <p>{@code username} 可能为 null：profile 行缺失（异常数据），或该用户已无可公开的 profile。
 * 此时前端应当不渲染跳转，而不是拼出 {@code /u/null}。actor 本身为 null 表示这条通知
 * 根本没有 actor（系统/历史类），与「有 actor 但查不到 profile」是两种不同情况。
 */
@Value
@Builder
public class NotificationActorView {
    /** 稳定用户标识（community_user.id）。 */
    String userId;
    /** 当前 canonical username，用于拼 /u/{username}；可能为 null。 */
    String username;
    /** 展示名；可能为 null。 */
    String displayName;
}
