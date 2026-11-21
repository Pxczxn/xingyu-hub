package top.pxczxn.xingyu.community.identity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserRoleMapper;
import top.pxczxn.xingyu.system.entity.SysRole;
import top.pxczxn.xingyu.system.identity.CommunityAdminGrantResult;
import top.pxczxn.xingyu.system.mapper.SysRoleMapper;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommunityAdminGrantServiceTest {

    private static final String EMAIL = "ops@example.com";
    private static final String USER_ID = "11111111-2222-4333-8444-555555555555";
    private static final String OTHER_ID = "99999999-aaaa-4bbb-8ccc-ddddeeeeffff";
    private static final String HASH = "$2a$10$unchangedHashValuexxxxxxxxxxxx";

    private CommunityUserMapper userMapper;
    private CommunityUserRoleMapper userRoleMapper;
    private SysRoleMapper roleMapper;
    private CommunityIdentityService identityService;
    private CommunityAdminGrantService service;

    @BeforeEach
    void setUp() {
        userMapper = mock(CommunityUserMapper.class);
        userRoleMapper = mock(CommunityUserRoleMapper.class);
        roleMapper = mock(SysRoleMapper.class);
        identityService = mock(CommunityIdentityService.class);
        service = new CommunityAdminGrantService(userMapper, userRoleMapper, roleMapper, identityService);
    }

    @Test
    void missingAccountFailsWithoutWrite() {
        when(userMapper.findAllByNormalizedEmail("ops@example.com")).thenReturn(List.of());
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertEquals("community account not found", ex.getMessage());
        verifyNoGrantWrite();
    }

    @Test
    void duplicateEmailFailsWithoutWrite() {
        when(userMapper.findAllByNormalizedEmail("ops@example.com"))
                .thenReturn(List.of(eligibleUser(USER_ID), eligibleUser(OTHER_ID)));
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertEquals("community account email is not unique", ex.getMessage());
        verifyNoGrantWrite();
    }

    @Test
    void suspendedAccountFailsWithoutWrite() {
        stubUniqueUser();
        when(identityService.evaluateLoginReadiness(USER_ID))
                .thenReturn(CommunityLoginReadiness.blocked(CommunityLoginBlockReason.SUSPENDED));
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertTrue(ex.getMessage().contains("SUSPENDED"));
        verifyNoGrantWrite();
    }

    @Test
    void pendingReviewFailsWithoutWrite() {
        stubUniqueUser();
        when(identityService.evaluateLoginReadiness(USER_ID))
                .thenReturn(CommunityLoginReadiness.blocked(CommunityLoginBlockReason.PENDING_REVIEW));
        assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        verifyNoGrantWrite();
    }

    @Test
    void rejectedFailsWithoutWrite() {
        stubUniqueUser();
        when(identityService.evaluateLoginReadiness(USER_ID))
                .thenReturn(CommunityLoginReadiness.blocked(CommunityLoginBlockReason.REJECTED));
        assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        verifyNoGrantWrite();
    }

    @Test
    void unverifiedEmailFailsWhenLoginReadinessBlocks() {
        stubUniqueUser();
        when(identityService.evaluateLoginReadiness(USER_ID))
                .thenReturn(CommunityLoginReadiness.blocked(CommunityLoginBlockReason.EMAIL_UNVERIFIED));
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertTrue(ex.getMessage().contains("EMAIL_UNVERIFIED"));
        verifyNoGrantWrite();
    }

    @Test
    void missingAdminRoleFailsWithoutWrite() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of());
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertEquals("admin role is missing", ex.getMessage());
        verify(userRoleMapper, never()).insert(anyString(), anyString(), anyLong(), any());
    }

    @Test
    void disabledAdminRoleFailsWithoutWrite() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of(role(1L, 0)));
        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        assertEquals("admin role is disabled", ex.getMessage());
        verify(userRoleMapper, never()).insert(anyString(), anyString(), anyLong(), any());
    }

    @Test
    void grantsAdminAndVerifiesEligibility() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of(role(7L, 1)));
        when(userRoleMapper.countByUserAndRole(USER_ID, 7L)).thenReturn(0);
        when(identityService.evaluateAdminConsoleEligibility(USER_ID)).thenReturn(eligible());

        CommunityAdminGrantResult result = service.grantExistingByEmail("  OPS@example.com ");
        assertEquals(USER_ID, result.communityUserId());
        assertFalse(result.alreadyGranted());
        ArgumentCaptor<String> userId = ArgumentCaptor.forClass(String.class);
        verify(userRoleMapper).insert(anyString(), userId.capture(), eq(7L), any());
        assertEquals(USER_ID, userId.getValue());
        verify(userMapper, never()).updateById(any());
        verify(userMapper, never()).insert(any());
    }

    @Test
    void existingGrantIsIdempotentAndStillChecksEligibility() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of(role(7L, 1)));
        when(userRoleMapper.countByUserAndRole(USER_ID, 7L)).thenReturn(1);
        when(identityService.evaluateAdminConsoleEligibility(USER_ID)).thenReturn(eligible());

        CommunityAdminGrantResult result = service.grantExistingByEmail(EMAIL);
        assertTrue(result.alreadyGranted());
        verify(userRoleMapper, never()).insert(anyString(), anyString(), anyLong(), any());
        verify(identityService).evaluateAdminConsoleEligibility(USER_ID);
    }

    @Test
    void postGrantEligibilityFailureAborts() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of(role(7L, 1)));
        when(userRoleMapper.countByUserAndRole(USER_ID, 7L)).thenReturn(0);
        when(identityService.evaluateAdminConsoleEligibility(USER_ID))
                .thenReturn(new AdminConsoleEligibility(false, CommunityLoginReadiness.ok(), List.of()));
        assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail(EMAIL));
        verify(userRoleMapper).insert(anyString(), eq(USER_ID), eq(7L), any());
    }

    @Test
    void insertFailureStopsBeforeEligibility() {
        stubEligibleUser();
        when(roleMapper.selectList(any())).thenReturn(List.of(role(7L, 1)));
        when(userRoleMapper.countByUserAndRole(USER_ID, 7L)).thenReturn(0);
        when(userRoleMapper.insert(anyString(), eq(USER_ID), eq(7L), any()))
                .thenThrow(new RuntimeException("constraint"));
        assertThrows(RuntimeException.class, () -> service.grantExistingByEmail(EMAIL));
        verify(identityService, never()).evaluateAdminConsoleEligibility(anyString());
        verify(userMapper, never()).updateById(any());
    }

    @Test
    void blankEmailRejected() {
        assertThrows(IllegalStateException.class, () -> service.grantExistingByEmail("  "));
        verifyNoGrantWrite();
    }

    private void stubUniqueUser() {
        when(userMapper.findAllByNormalizedEmail("ops@example.com")).thenReturn(List.of(eligibleUser(USER_ID)));
    }

    private void stubEligibleUser() {
        stubUniqueUser();
        when(identityService.evaluateLoginReadiness(USER_ID)).thenReturn(CommunityLoginReadiness.ok());
    }

    private void verifyNoGrantWrite() {
        verify(userRoleMapper, never()).insert(anyString(), anyString(), anyLong(), any());
        verify(userMapper, never()).updateById(any());
        verify(userMapper, never()).insert(any());
    }

    private static CommunityUser eligibleUser(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        user.setEmail(EMAIL);
        user.setPasswordHash(HASH);
        user.setStatus("ACTIVE");
        user.setRole("FOUNDER");
        user.setEmailVerifiedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return user;
    }

    private static SysRole role(long id, int status) {
        SysRole role = new SysRole();
        role.setId(id);
        role.setCode("admin");
        role.setStatus(status);
        return role;
    }

    private static AdminConsoleEligibility eligible() {
        return new AdminConsoleEligibility(true, CommunityLoginReadiness.ok(), List.of("admin"));
    }
}
