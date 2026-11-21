package top.pxczxn.xingyu.websocket;

import jakarta.servlet.ServletContext;
import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.ConfigurationCondition;
import org.springframework.core.io.ResourceLoader;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.web.context.WebApplicationContext;

/**
 * Matches when the current ServletContext is a real container context.
 *
 * <p>Spring Boot MOCK tests use {@code MockServletContext}, which never carries
 * {@code jakarta.websocket.server.ServerContainer}. Skipping the factory bean
 * in that case lets the application context start. A real ServletContext still
 * creates the bean, so a missing ServerContainer continues to fail startup.
 */
public final class OnNonMockServletContextCondition implements ConfigurationCondition {

    static final String MOCK_SERVLET_CONTEXT_CLASS = "org.springframework.mock.web.MockServletContext";

    @Override
    public ConfigurationPhase getConfigurationPhase() {
        return ConfigurationPhase.REGISTER_BEAN;
    }

    @Override
    public boolean matches(ConditionContext context, AnnotatedTypeMetadata metadata) {
        return shouldBindServerContainer(resolveServletContext(context));
    }

    static boolean shouldBindServerContainer(ServletContext servletContext) {
        if (servletContext == null) {
            return true;
        }
        return !isSpringMockServletContext(servletContext);
    }

    static boolean isSpringMockServletContext(ServletContext servletContext) {
        Class<?> type = servletContext.getClass();
        while (type != null && type != Object.class) {
            if (MOCK_SERVLET_CONTEXT_CLASS.equals(type.getName())) {
                return true;
            }
            type = type.getSuperclass();
        }
        return false;
    }

    static ServletContext resolveServletContext(ConditionContext context) {
        ResourceLoader loader = context.getResourceLoader();
        if (loader instanceof WebApplicationContext webApplicationContext) {
            return webApplicationContext.getServletContext();
        }
        ConfigurableListableBeanFactory factory = context.getBeanFactory();
        if (factory != null && factory.containsBean("servletContext")) {
            Object bean = factory.getBean("servletContext");
            if (bean instanceof ServletContext servletContext) {
                return servletContext;
            }
        }
        return null;
    }
}
