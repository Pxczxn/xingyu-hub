package top.pxczxn.xingyu.system.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.mapper.SysConfigGroupMapper;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysConfigGroupRedisOptionalTest {

    @Test
    void refreshCacheStartsWhenRedisIsDownAndKeepsLocalEntries() {
        SysConfigGroupMapper mapper = mock(SysConfigGroupMapper.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        doThrow(new RedisConnectionFailureException("down")).when(ops).set(anyString(), anyString());

        SysConfigGroup login = new SysConfigGroup();
        login.setGroupCode("login");
        login.setConfigValue("{\"captchaEnabled\":true}");
        when(mapper.selectList(null)).thenReturn(List.of(login));

        SysConfigGroupServiceImpl service = new SysConfigGroupServiceImpl(mapper, redis, new ObjectMapper());
        assertDoesNotThrow(service::refreshCache);
        assertSame(login, service.getByGroupCode("login"));
        assertEquals("{\"captchaEnabled\":true}", service.getByGroupCode("login").getConfigValue());
    }

    @Test
    void saveConfigPersistsEvenWhenRedisIsDown() {
        SysConfigGroupMapper mapper = mock(SysConfigGroupMapper.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        doThrow(new RedisConnectionFailureException("down")).when(ops).set(anyString(), anyString());

        SysConfigGroup existing = new SysConfigGroup();
        existing.setGroupCode("login");
        when(mapper.selectByGroupCode("login")).thenReturn(existing);

        SysConfigGroupServiceImpl service = new SysConfigGroupServiceImpl(mapper, redis, new ObjectMapper());
        service.saveConfig("login", "{\"captchaEnabled\":false}");
        verify(mapper).updateById(existing);
        assertEquals("{\"captchaEnabled\":false}", service.getByGroupCode("login").getConfigValue());
    }
}
