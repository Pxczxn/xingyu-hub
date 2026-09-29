package top.pxczxn.xingyu.community.event;

import java.util.Map;

public record CommunityChatRealtimeEvent(String conversationId, String eventType, Map<String, Object> payload) {
}
