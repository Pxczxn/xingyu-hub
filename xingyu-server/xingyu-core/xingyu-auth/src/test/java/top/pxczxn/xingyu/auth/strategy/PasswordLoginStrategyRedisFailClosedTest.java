package top.pxczxn.xingyu.auth.strategy;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import top.pxczxn.xingyu.auth.LoginHelper;
import top.pxczxn.xingyu.auth.LoginRequest;
import top.pxczxn.xingyu.auth.enums.ClientType;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.identity.AdminConsoleIdentityPort;
import top.pxczxn.xingyu.system.support.RedisGuard;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PasswordLoginStrategyRedisFailClosedTest {

    @Test
    void loginRetryCheckFailsClosedWhenRedisIsDown() {
        AdminConsoleIdentityPort identity = mock(AdminConsoleIdentityPort.class);
        SystemConfigHelper config = mock(SystemConfigHelper.class);
        when(config.isCaptchaEnabled()).thenReturn(false);
        when(config.getMaxRetryCount()).thenReturn(5);

        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString())).thenThrow(new RedisConnectionFailureException("down"));

        PasswordLoginStrategy strategy = new PasswordLoginStrategy(
                identity, config, redis, mock(LoginHelper.class));
        LoginRequest request = new LoginRequest();
        request.setClientType(ClientType.ADMIN);
        request.setUsername("ops");
        request.setPassword("secret");

        BusinessException ex = assertThrows(BusinessException.class, () -> strategy.login(request));
        assertEquals(RedisGuard.UNAVAILABLE_MESSAGE, ex.getMessage());
        verify(identity, never()).lookupByLogin(anyString());
    }
}
