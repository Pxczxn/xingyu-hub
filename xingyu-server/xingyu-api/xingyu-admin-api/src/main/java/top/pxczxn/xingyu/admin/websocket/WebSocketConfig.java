package top.pxczxn.xingyu.admin.websocket;

import top.pxczxn.xingyu.websocket.WebSocketHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket配置
 * 注册业务WebSocket处理器，容器配置由 xingyu-websocket 模块提供
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final MessageWebSocketHandler messageWebSocketHandler;
    private final SshWebSocketHandler sshWebSocketHandler;
    private final CommunityChatWebSocketHandler communityChatWebSocketHandler;
    private final WebSocketHandshakeInterceptor handshakeInterceptor;
    private final CommunityWebSocketHandshakeInterceptor communityHandshakeInterceptor;

    public WebSocketConfig(
            MessageWebSocketHandler messageWebSocketHandler,
            SshWebSocketHandler sshWebSocketHandler,
            CommunityChatWebSocketHandler communityChatWebSocketHandler,
            WebSocketHandshakeInterceptor handshakeInterceptor,
            CommunityWebSocketHandshakeInterceptor communityHandshakeInterceptor) {
        this.messageWebSocketHandler = messageWebSocketHandler;
        this.sshWebSocketHandler = sshWebSocketHandler;
        this.communityChatWebSocketHandler = communityChatWebSocketHandler;
        this.handshakeInterceptor = handshakeInterceptor;
        this.communityHandshakeInterceptor = communityHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 消息 WebSocket
        registry.addHandler(messageWebSocketHandler, "/ws/message")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins("*");

        // SSH 终端 WebSocket
        registry.addHandler(sshWebSocketHandler, "/ws/ssh")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins("*");

        // 社区私信/群聊实时推送
        registry.addHandler(communityChatWebSocketHandler, "/ws/community/chat")
                .addInterceptors(communityHandshakeInterceptor)
                .setAllowedOrigins("*");
    }
}
