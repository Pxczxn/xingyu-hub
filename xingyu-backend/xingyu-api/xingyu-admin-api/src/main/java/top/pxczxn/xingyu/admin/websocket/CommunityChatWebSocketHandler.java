package top.pxczxn.xingyu.admin.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import top.pxczxn.xingyu.community.dto.ChatMessageView;
import top.pxczxn.xingyu.community.entity.ConversationMember;
import top.pxczxn.xingyu.community.mapper.ConversationMemberMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 社区私信/群聊实时推送。消息仍经 HTTP 写入；本通道负责多端同步与离线补偿前的即时通知。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommunityChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final ConversationMemberMapper memberMapper;

    /** userId -> session */
    private static final Map<String, WebSocketSession> SESSIONS = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = getUserId(session);
        if (userId == null) {
            closeQuietly(session);
            return;
        }
        WebSocketSession previous = SESSIONS.put(userId, session);
        if (previous != null && previous.isOpen() && previous != session) {
            closeQuietly(previous);
        }
        sendJson(session, Map.of("type", "connected", "userId", userId));
        log.info("社区聊天 WebSocket 已连接 userId={}，在线 {}", userId, SESSIONS.size());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
            String type = payload.get("type") == null ? "" : String.valueOf(payload.get("type"));
            if ("ping".equals(type)) {
                sendJson(session, Map.of("type", "pong"));
            }
        } catch (Exception ex) {
            log.debug("忽略无效 WebSocket 消息: {}", ex.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String userId = getUserId(session);
        if (userId != null) {
            SESSIONS.remove(userId, session);
            log.info("社区聊天 WebSocket 断开 userId={}，在线 {}", userId, SESSIONS.size());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("社区聊天 WebSocket 传输错误", exception);
        String userId = getUserId(session);
        if (userId != null) {
            SESSIONS.remove(userId, session);
        }
    }

    public void broadcastMessage(String conversationId, ChatMessageView message) {
        broadcastPayload(conversationId, "message", Map.of("message", message));
    }

    public void broadcastPayload(String conversationId, String eventType, Map<String, Object> payload) {
        List<ConversationMember> members = memberMapper.listByConversationId(conversationId);
        Map<String, Object> envelope = Map.of(
                "type", eventType,
                "conversationId", conversationId);
        Map<String, Object> merged = new java.util.HashMap<>(envelope);
        merged.putAll(payload);
        for (ConversationMember member : members) {
            WebSocketSession session = SESSIONS.get(member.getUserId());
            if (session != null && session.isOpen()) {
                sendJson(session, merged);
            }
        }
    }

    private static String getUserId(WebSocketSession session) {
        Object userId = session.getAttributes().get("communityUserId");
        return userId == null ? null : String.valueOf(userId);
    }

    private void sendJson(WebSocketSession session, Object payload) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
            }
        } catch (IOException ex) {
            log.error("发送社区 WebSocket 消息失败", ex);
        }
    }

    private static void closeQuietly(WebSocketSession session) {
        try {
            session.close();
        } catch (IOException ignored) {
            // ignore
        }
    }
}
