package top.pxczxn.xingyu.admin.websocket;

import cn.dev33.satoken.stp.StpUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * SSH 终端只允许已登录且持有 admin 角色的后台账号。
 * 社区会话和普通后台角色都在握手阶段拒绝。
 */
@Slf4j
@Component
public class SshWebSocketHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {
        if (!(request instanceof ServletServerHttpRequest servletRequest)) {
            return false;
        }
        String token = servletRequest.getServletRequest().getParameter("token");
        if (token == null || token.isBlank()) {
            return false;
        }
        try {
            Object loginId = StpUtil.getLoginIdByToken(token.trim());
            if (loginId == null) {
                log.warn("SSH WebSocket 拒绝无效 Token");
                return false;
            }
            if (!StpUtil.hasRole(loginId, "admin")) {
                log.warn("SSH WebSocket 拒绝非管理员连接 loginId={}", loginId);
                return false;
            }
            attributes.put("loginId", loginId.toString());
            attributes.put("token", token.trim());
            return true;
        } catch (RuntimeException ex) {
            log.warn("SSH WebSocket 管理员校验失败");
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
    }
}
