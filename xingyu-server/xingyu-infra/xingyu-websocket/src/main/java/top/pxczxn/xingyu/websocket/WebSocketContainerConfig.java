package top.pxczxn.xingyu.websocket;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket容器配置
 * 配置WebSocket的缓冲区大小和会话超时等基础参数
 *
 * <p>仅在 Servlet Web 环境生效：本类创建的 {@link ServletServerContainerFactoryBean} 需要
 * ServletContext，在非 Web 环境（如 Bootstrap CLI 的 WebApplicationType.NONE）实例化会直接
 * 抛 "A ServletContext is required"，导致这类命令行工具根本无法启动。
 */
@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class WebSocketContainerConfig {

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(8192);
        container.setMaxBinaryMessageBufferSize(8192);
        container.setMaxSessionIdleTimeout(60000L);
        return container;
    }
}
