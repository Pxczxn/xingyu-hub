package top.pxczxn.xingyu.system.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import top.pxczxn.xingyu.common.exception.BusinessException;
import top.pxczxn.xingyu.system.entity.SysConfigGroup;
import top.pxczxn.xingyu.system.mapper.SysConfigGroupMapper;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SysConfigGroupRegisterRoleSaveTest {

    @Test
    void saveRegisterConfigRejectsAdminAndDoesNotPersist() {
        SysConfigGroupMapper mapper = mock(SysConfigGroupMapper.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        SysConfigGroup existing = new SysConfigGroup();
        existing.setGroupCode("register");
        existing.setConfigValue("{\"defaultRole\":\"user\"}");
        when(mapper.selectByGroupCode("register")).thenReturn(existing);

        SysConfigGroupServiceImpl service = new SysConfigGroupServiceImpl(mapper, redis, new ObjectMapper());

        assertThrows(BusinessException.class, () -> service.saveConfig(
                "register",
                "{\"enabled\":true,\"defaultRole\":\"admin\"}"));
        verify(mapper, never()).updateById(any());
    }

    @Test
    void saveRegisterConfigAllowsMember() {
        SysConfigGroupMapper mapper = mock(SysConfigGroupMapper.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        SysConfigGroup existing = new SysConfigGroup();
        existing.setGroupCode("register");
        when(mapper.selectByGroupCode("register")).thenReturn(existing);
        when(redis.opsForValue()).thenReturn(mock(org.springframework.data.redis.core.ValueOperations.class));

        SysConfigGroupServiceImpl service = new SysConfigGroupServiceImpl(mapper, redis, new ObjectMapper());
        service.saveConfig("register", "{\"enabled\":true,\"defaultRole\":\"member\"}");

        verify(mapper).updateById(existing);
    }
}
