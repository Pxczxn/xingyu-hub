package top.pxczxn.xingyu.system.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import top.pxczxn.xingyu.system.mapper.CommunityRbacMapper;
import top.pxczxn.xingyu.system.rbac.CommunityGrantedRole;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommunityRbacServiceImplTest {

    private CommunityRbacMapper mapper;
    private CommunityRbacServiceImpl service;

    @BeforeEach
    void setUp() {
        mapper = mock(CommunityRbacMapper.class);
        service = new CommunityRbacServiceImpl(mapper);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void blankUserIdReturnsEmptyWithoutQuery(String userId) {
        assertEquals(List.of(), service.listRoles(userId));
        assertEquals(List.of(), service.listRoleCodes(userId));
        assertEquals(List.of(), service.listPermissions(userId));
        assertFalse(service.hasRole(userId, "admin"));
        assertFalse(service.hasPermission(userId, "sys:user:list"));
        verify(mapper, never()).selectRolesByCommunityUserId(org.mockito.ArgumentMatchers.any());
        verify(mapper, never()).selectPermissionsByCommunityUserId(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void missingUserReturnsEmptyWhenMapperFindsNothing() {
        when(mapper.selectRolesByCommunityUserId("missing-user")).thenReturn(List.of());
        when(mapper.selectPermissionsByCommunityUserId("missing-user")).thenReturn(List.of());
        assertEquals(List.of(), service.listRoles("missing-user"));
        assertEquals(List.of(), service.listPermissions("missing-user"));
        assertFalse(service.hasRole("missing-user", "user"));
    }

    @Test
    void singleRoleIsReturned() {
        CommunityGrantedRole role = role(2L, "user", "普通用户");
        when(mapper.selectRolesByCommunityUserId("u1")).thenReturn(List.of(role));
        List<CommunityGrantedRole> roles = service.listRoles("u1");
        assertEquals(1, roles.size());
        assertEquals("user", roles.getFirst().getCode());
        assertTrue(service.hasRole("u1", "user"));
        assertFalse(service.hasRole("u1", "admin"));
    }

    @Test
    void permissionsAreDedupedAndMerged() {
        when(mapper.selectPermissionsByCommunityUserId("u1"))
                .thenReturn(List.of("sys:user:list", "sys:role:list", "sys:user:list", " "));
        List<String> permissions = service.listPermissions("u1");
        assertEquals(List.of("sys:user:list", "sys:role:list"), permissions);
        assertTrue(service.hasPermission("u1", "sys:role:list"));
        assertFalse(service.hasPermission("u1", "sys:user:delete"));
    }

    @Test
    void mapperIsInvokedOncePerRead() {
        when(mapper.selectRolesByCommunityUserId("u1")).thenReturn(List.of(role(1L, "admin", "管理员")));
        service.listRoles("u1");
        verify(mapper).selectRolesByCommunityUserId("u1");
        when(mapper.selectPermissionsByCommunityUserId("u1")).thenReturn(List.of("sys:user:list"));
        service.listPermissions("u1");
        verify(mapper).selectPermissionsByCommunityUserId("u1");
    }

    private static CommunityGrantedRole role(Long id, String code, String name) {
        CommunityGrantedRole role = new CommunityGrantedRole();
        role.setId(id);
        role.setCode(code);
        role.setName(name);
        return role;
    }
}
