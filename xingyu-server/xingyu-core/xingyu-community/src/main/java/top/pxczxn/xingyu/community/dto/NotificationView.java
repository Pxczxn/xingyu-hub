package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 一条通知的对外结构。
 *
 * <p>契约（2026-10-06 通知契约恢复）：
 * <ul>
 *   <li><b>action</b> = {@code category}（自由字符串，当前真实 producer 只有 {@code FOLLOW}）；
 *   <li><b>actor</b> = {@link NotificationActorView}，触发者。系统/历史类通知为 null；
 *   <li><b>target</b> = 通知的接收者本身（{@code notification.user_id}，即「你」）。
 *       FOLLOW 的目标语义就是「你被关注了」，没有内容对象，因此不设 object/target 结构；
 *       将来真出现「谁赞了你的文章」这类通知时再补，不提前设计。
 * </ul>
 *
 * <p>{@code title} / {@code body} 仍是展示文案（前端直接渲染），{@code actor} 是导航与
 * 结构化渲染所需的稳定身份。两者不是重复数据：文案是给人读的，actor 是给跳转用的。
 */
@Value
@Builder
public class NotificationView {
    String id;
    String category;
    String title;
    String body;
    boolean read;
    Instant createdAt;
    /** 触发这条通知的人；没有 actor 时为 null。 */
    NotificationActorView actor;
}
