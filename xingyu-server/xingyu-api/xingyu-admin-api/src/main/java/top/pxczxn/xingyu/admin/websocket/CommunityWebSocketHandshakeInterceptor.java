package top.pxczxn.xingyu.admin.websocket;

import top.pxczxn.xingyu.community.entity.CommunitySession;
import top.pxczxn.xingyu.community.service.CommunityAccountService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * 社区用户 WebSocket 握手：使用 satoken 会话，而非管理端 Sa-Token。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CommunityWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    private final CommunityAccountService accountService;

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        try {
            if (!(request instanceof ServletServerHttpRequest servletRequest)) {
                return false;
            }
            String token = servletRequest.getServletRequest().getParameter("token");
            if (token == null || token.isBlank()) {
                token = servletRequest.getServletRequest().getHeader("satoken");
            }
            if (token == null || token.isBlank()) {
                log.warn("社区 WebSocket 握手失败：缺少 token");
                return false;
            }
            CommunitySession session = accountService.requireActiveSession(token.trim());
            attributes.put("communityUserId", session.getUserId());
            attributes.put("communityToken", token.trim());
            log.info("社区 WebSocket 握手成功，用户: {}", session.getUserId());
            return true;
        } catch (Exception ex) {
            log.warn("社区 WebSocket 握手失败: {}", ex.getMessage());
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // no-op
    }
}
