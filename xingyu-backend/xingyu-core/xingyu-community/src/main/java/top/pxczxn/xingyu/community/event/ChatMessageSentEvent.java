package top.pxczxn.xingyu.community.event;

import top.pxczxn.xingyu.community.dto.ChatMessageView;

/**
 * 会话消息写入成功后发布，供 WebSocket 等实时通道推送。
 */
public record ChatMessageSentEvent(String conversationId, ChatMessageView message) {
}
