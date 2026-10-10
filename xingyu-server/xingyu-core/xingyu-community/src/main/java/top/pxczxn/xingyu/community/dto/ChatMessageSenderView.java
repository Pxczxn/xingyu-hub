package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 消息的结构化发送者（2026-10-06 契约补齐）。
 *
 * <p>此前 {@code ChatMessageView} 只有 {@code senderId}，前端在群聊里只能显示
 * 「UUID 前 8 位…」（{@code senderLabel}），并且发送者改名后连一个名字都拿不到。
 *
 * <p>与通知的 {@link NotificationActorView} 同一套原则：
 * <ul>
 *   <li>{@code chat_message} 只存稳定的 {@code sender_id}，<b>不</b>把 username 快照进表；</li>
 *   <li>{@code username} / {@code displayName} / {@code avatar} 是<b>读取时</b>按 sender_id
 *       现查 {@code community_profile} 得到的当前值 → 改名后历史消息自动跟着变，
 *       前端用 {@code /u/{username}} 就能导航到当前主页。</li>
 * </ul>
 *
 * <p>{@code username} 可能为 null（profile 行缺失），此时前端不应渲染链接。
 * {@code displayName} 为空时前端回落到 {@code username}。
 */
@Value
@Builder
public class ChatMessageSenderView {
    /** 稳定用户标识（community_user.id），等于 ChatMessageView.senderId。 */
    String userId;
    /** 当前 canonical username，用于 /u/{username}；可能为 null。 */
    String username;
    /** 当前展示名；可能为 null。 */
    String displayName;
    /** 当前头像（存在 profile.settings_json.avatar）；可能为 null。 */
    String avatar;
}
