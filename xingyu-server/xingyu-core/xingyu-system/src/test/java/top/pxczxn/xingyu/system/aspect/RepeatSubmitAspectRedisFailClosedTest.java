package top.pxczxn.xingyu.system.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.aspectj.lang.JoinPoint;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.annotation.RepeatSubmit;
import top.pxczxn.xingyu.system.support.RedisGuard;

import java.lang.reflect.Method;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RepeatSubmitAspectRedisFailClosedTest {

    @AfterEach
    void clearRequest() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void redisDownDoesNotAllowSubmit() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(anyString(), anyString(), anyLong(), any(TimeUnit.class)))
                .thenThrow(new RedisConnectionFailureException("down"));

        BusinessException ex = assertThrows(BusinessException.class, () -> invoke(redis));
        assertEquals(RedisGuard.UNAVAILABLE_MESSAGE, ex.getMessage());
    }

    @Test
    void nullSetIfAbsentDoesNotAllowSubmit() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.setIfAbsent(anyString(), anyString(), anyLong(), any(TimeUnit.class))).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> invoke(redis));
        assertEquals("请勿重复提交", ex.getMessage());
    }

    private static void invoke(StringRedisTemplate redis) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/demo");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        RepeatSubmitAspect aspect = new RepeatSubmitAspect(redis, new ObjectMapper());
        Method method = Sample.class.getDeclaredMethod("submit");
        RepeatSubmit annotation = method.getAnnotation(RepeatSubmit.class);
        JoinPoint joinPoint = mock(JoinPoint.class);
        when(joinPoint.getArgs()).thenReturn(new Object[0]);
        aspect.before(joinPoint, annotation);
    }

    static class Sample {
        @RepeatSubmit
        void submit() {
        }
    }
}
