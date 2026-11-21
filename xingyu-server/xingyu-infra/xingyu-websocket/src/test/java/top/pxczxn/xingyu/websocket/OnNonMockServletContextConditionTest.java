package top.pxczxn.xingyu.websocket;

import jakarta.servlet.ServletContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.BeanCreationException;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OnNonMockServletContextConditionTest {

    @Test
    void mockServletContextDoesNotBindServerContainer() {
        assertFalse(OnNonMockServletContextCondition.shouldBindServerContainer(new MockServletContext()));
        assertTrue(OnNonMockServletContextCondition.isSpringMockServletContext(new MockServletContext()));
    }

    @Test
    void nonMockServletContextStillBindsServerContainer() {
        ServletContext servletContext = mock(ServletContext.class);
        assertTrue(OnNonMockServletContextCondition.shouldBindServerContainer(servletContext));
        assertFalse(OnNonMockServletContextCondition.isSpringMockServletContext(servletContext));
    }

    @Test
    void missingServletContextStillAttemptsBind() {
        assertTrue(OnNonMockServletContextCondition.shouldBindServerContainer(null));
    }

    @Test
    void mockWebContextSkipsFactoryBean() {
        AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(WebSocketContainerConfig.class);
        context.refresh();
        try {
            assertEquals(0, context.getBeanNamesForType(ServletServerContainerFactoryBean.class).length);
        } finally {
            context.close();
        }
    }

    @Test
    void noneWebContextSkipsFactoryBean() {
        AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext();
        context.register(WebSocketContainerConfig.class);
        context.refresh();
        try {
            assertEquals(0, context.getBeanNamesForType(ServletServerContainerFactoryBean.class).length);
        } finally {
            context.close();
        }
    }

    @Test
    void realWebContextStillFailsWithoutServerContainer() {
        ServletContext servletContext = mock(ServletContext.class);
        when(servletContext.getInitParameterNames()).thenReturn(Collections.emptyEnumeration());
        when(servletContext.getAttributeNames()).thenReturn(Collections.emptyEnumeration());
        AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(servletContext);
        context.register(WebSocketContainerConfig.class);
        BeanCreationException failure = assertThrows(BeanCreationException.class, context::refresh);
        assertTrue(failure.getMessage().contains("jakarta.websocket.server.ServerContainer")
                || (failure.getCause() != null
                && failure.getCause().getMessage() != null
                && failure.getCause().getMessage().contains("jakarta.websocket.server.ServerContainer")));
        context.close();
    }
}
