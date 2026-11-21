package top.pxczxn.xingyu.system.service;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.support.RedisGuard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CaptchaServiceRedisFailClosedTest {

    @Test
    void generateFailsClosedWhenRedisIsDown() {
        SystemConfigHelper config = mock(SystemConfigHelper.class);
        when(config.getCaptchaType()).thenReturn("line");
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        doThrow(new RedisConnectionFailureException("down"))
                .when(ops).set(anyString(), anyString(), anyLong(), any());

        CaptchaService service = new CaptchaService(config, redis);
        BusinessException ex = assertThrows(BusinessException.class, service::generateImageCaptcha);
        assertEquals(RedisGuard.UNAVAILABLE_MESSAGE, ex.getMessage());
    }

    @Test
    void validateFailsClosedWhenRedisIsDown() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));

        CaptchaService service = new CaptchaService(mock(SystemConfigHelper.class), redis);
        BusinessException ex = assertThrows(
                BusinessException.class, () -> service.validateImageCaptcha("uuid", "code"));
        assertEquals(RedisGuard.UNAVAILABLE_MESSAGE, ex.getMessage());
    }
}
