package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

/**
 * 未读通知数。
 *
 * <p>为什么不复用 {@code GET /home} 的 {@code unreadNotifications}：那个端点会顺带组装
 * 首页所有内容轨（推荐、卡片补全），为了一个角标数字跑一遍首页成本明显不成比例。这里只做
 * 一次 {@code COUNT(*)}，是 Header 角标的专用事实源。
 */
@Value
@Builder
public class NotificationUnreadCountView {
    long unread;
}
