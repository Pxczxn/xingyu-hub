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
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 社区私信/群聊实时推送。消息仍经 HTTP 写入；本通道负责多端同步。
 *
 * <p><b>2026-10-06：一个用户可以有多个并存会话（多标签页 / 多设备）。</b>
 *
 * <p>此前这里是一个 {@code Map<String userId, WebSocketSession>} 单值表，新连接会
 * {@code closeQuietly(previous)} 把同账号的旧连接踢掉。而前端为了拿推送，同时开着
 * {@code AppLayout}、{@code MailboxPage}、{@code ConversationThreadPage} 三条连接
 * （后两者直接写死 {@code enabled=true}），于是三条连接每 3 秒互相踢一次：只有最后
 * 一条能收到帧，客户端重连又立刻把上一条踢掉，实测在一次审计里产生了 700+ 次
 * 连接/断开抖动，并且「实时收到消息」随时会退化成「必须刷新」。
 *
 * <p>现在改为 {@code userId -> Set<WebSocketSession>}：
 * <ul>
 *   <li>新连接<b>不</b>关闭同账号的旧连接；</li>
 *   <li>断开时只移除<b>当前</b>这条 session（用两参 remove，避免误删同用户的其它连接）；</li>
 *   <li>广播时把消息发给该用户名的全部有效 session，单条坏连接就地清理并移除，
 *       不影响其它连接。</li>
 * </ul>
 *
 * <p>连接本身仍然只负责「实时推送」：它不重放离线期间的消息，也不做增量对账 ——
 * 重连后的补齐由前端用 REST 按 {@code sequence_number} 对账完成（见
 * {@code use-community-chat-socket.ts}）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommunityChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final ConversationMemberMapper memberMapper;

    /** 单条连接的写超时；超过则该连接视为失效并被摘掉。 */
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    /** 单条连接的发送缓冲上限，防止慢客户端把内存吃光。 */
    private static final int SEND_BUFFER_LIMIT_BYTES = 512 * 1024;

    /** userId -> 该用户当前所有在线连接。 */
    private final Map<String, Set<WebSocketSession>> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String userId = getUserId(session);
        if (userId == null) {
            closeQuietly(session);
            return;
        }
        // Serialise writes per connection.
        //
        // Tomcat's endpoint is a state machine and is NOT safe for concurrent
        // `sendText`: two broadcasts racing on the same session throw
        // `IllegalStateException: ... TEXT_PARTIAL_WRITING`. Before, a user had one
        // session and that was already reachable (two conversations, two concurrent
        // REST sends); with several sessions per user it stays reachable. The
        // decorator buffers and serialises so a burst cannot interleave.
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES);
        sessions
                .computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet())
                .add(safe);
        sendJson(safe, Map.of("type", "connected", "userId", userId));
        log.info("社区聊天 WebSocket 已连接 userId={}，该用户连接数 {}", userId, onlineCount(userId));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
            String type = payload.get("type") == null ? "" : String.valueOf(payload.get("type"));
            if ("ping".equals(type)) {
                // The incoming session is the raw one; the map holds the decorator.
                // Looking the decorator up keeps ping replies serialised too.
                sendJson(decoratedFor(session), Map.of("type", "pong"));
            }
        } catch (Exception ex) {
            log.debug("忽略无效 WebSocket 消息: {}", ex.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        removeSession(session);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("社区聊天 WebSocket 传输错误", exception);
        removeSession(session);
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
            Set<WebSocketSession> userSessions = sessions.get(member.getUserId());
            if (userSessions == null || userSessions.isEmpty()) {
                continue;
            }
            for (WebSocketSession session : userSessions) {
                if (!session.isOpen()) {
                    // 坏连接就地清理，不能拖住同一用户的其它连接。
                    removeSession(session);
                    continue;
                }
                if (!sendJson(session, merged)) {
                    removeSession(session);
                }
            }
        }
    }

    /** 只移除这一条 session；用户没有连接了才回收 map 条目。 */
    private void removeSession(WebSocketSession session) {
        String userId = getUserId(session);
        if (userId == null) {
            return;
        }
        Set<WebSocketSession> userSessions = sessions.get(userId);
        if (userSessions == null) {
            return;
        }
        userSessions.remove(session);
        if (userSessions.isEmpty()) {
            sessions.remove(userId, userSessions);
        }
        log.info("社区聊天 WebSocket 断开 userId={}，该用户连接数 {}", userId, onlineCount(userId));
    }

    private int onlineCount(String userId) {
        Set<WebSocketSession> userSessions = sessions.get(userId);
        return userSessions == null ? 0 : userSessions.size();
    }

    /**
     * 把入站消息所属的 session 换成注册在 map 里的那个（带写串行化的装饰器）。
     * 找不到就原样返回，行为与从前一致。
     */
    private WebSocketSession decoratedFor(WebSocketSession session) {
        String userId = getUserId(session);
        if (userId == null) {
            return session;
        }
        Set<WebSocketSession> userSessions = sessions.get(userId);
        if (userSessions == null) {
            return session;
        }
        for (WebSocketSession candidate : userSessions) {
            if (candidate.getId().equals(session.getId())) {
                return candidate;
            }
        }
        return session;
    }

    private static String getUserId(WebSocketSession session) {
        Object userId = session.getAttributes().get("communityUserId");
        return userId == null ? null : String.valueOf(userId);
    }

    /** @return true 表示已发出；false 表示发送失败（连接已不可用）。 */
    private boolean sendJson(WebSocketSession session, Object payload) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(payload)));
                return true;
            }
            return false;
        } catch (Exception ex) {
            // 实时推送是**辅助**通道：它绝不能让已经写库成功的发送请求变成 500。
            // 所以这里捕获所有异常（含 Tomcat 的并发写 IllegalStateException），
            // 记日志并让调用方把这条连接摘掉。
            log.warn("发送社区 WebSocket 消息失败，关闭该连接", ex);
            return false;
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
