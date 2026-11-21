package top.pxczxn.xingyu.websocket;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket容器配置
 * 配置WebSocket的缓冲区大小和会话超时等基础参数
 *
 * <p>仅在 Servlet Web 环境生效：本类创建的 {@link ServletServerContainerFactoryBean} 需要
 * ServletContext，在非 Web 环境（如 Bootstrap CLI 的 WebApplicationType.NONE）实例化会直接
 * 抛 "A ServletContext is required"，导致这类命令行工具根本无法启动。
 *
 * <p>Spring Boot MOCK 使用 {@code MockServletContext}，没有容器挂上的
 * {@code ServerContainer}。该 Bean 在 MOCK 下跳过，真实 Servlet 容器仍创建并在
 * 缺少 {@code ServerContainer} 时 fail-fast。
 */
@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class WebSocketContainerConfig {

    @Bean
    @Conditional(OnNonMockServletContextCondition.class)
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(8192);
        container.setMaxBinaryMessageBufferSize(8192);
        container.setMaxSessionIdleTimeout(60000L);
        return container;
    }
}
