package top.pxczxn.xingyu.community.identity;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommunityIdentityServiceImplTest {

    private CommunityUserMapper userMapper;
    private SystemConfigHelper configHelper;
    private CommunityRbacService rbacService;
    private CommunityIdentityServiceImpl service;

    @BeforeEach
    void setUp() {
        userMapper = mock(CommunityUserMapper.class);
        configHelper = mock(SystemConfigHelper.class);
        rbacService = mock(CommunityRbacService.class);
        service = new CommunityIdentityServiceImpl(userMapper, configHelper, rbacService);
        when(configHelper.isRegisterVerifyEmail()).thenReturn(false);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"   "})
    void blankIdDoesNotQueryUser(String id) {
        assertTrue(service.findById(id).isEmpty());
        assertEquals(CommunityLoginBlockReason.NOT_FOUND, service.evaluateLoginReadiness(id).reason());
        verify(userMapper, never()).selectById(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void missingUuidIsNotFoundAndNotEligible() {
        when(userMapper.selectById("missing")).thenReturn(null);
        when(rbacService.listRoleCodes("missing")).thenReturn(List.of());
        assertTrue(service.findById("missing").isEmpty());
        assertEquals(CommunityLoginBlockReason.NOT_FOUND, service.evaluateLoginReadiness("missing").reason());
        AdminConsoleEligibility eligibility = service.evaluateAdminConsoleEligibility("missing");
        assertFalse(eligibility.eligible());
        assertFalse(service.passwordMatches("missing", "any"));
    }

    @Test
    void identityViewOmitsPasswordHash() throws Exception {
        CommunityUser user = activeUser();
        user.setPasswordHash(PasswordSupport.hash("Secret123!"));
        when(userMapper.selectById("u1")).thenReturn(user);
        Optional<CommunityIdentityView> view = service.findById("u1");
        assertTrue(view.isPresent());
        assertEquals("u1", view.get().id());
        assertEquals("a@example.com", view.get().email());
        assertEquals("ACTIVE", view.get().status());
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        String json = mapper.writeValueAsString(view.get());
        assertFalse(json.contains("password"));
        assertFalse(json.contains(user.getPasswordHash()));
    }

    @Test
    void pendingRejectedSuspendedAndUnverifiedBlockLogin() {
        when(configHelper.isRegisterVerifyEmail()).thenReturn(true);
        CommunityUser pending = activeUser();
        pending.setStatus("PENDING_REVIEW");
        pending.setEmailVerifiedAt(Instant.now());
        when(userMapper.selectById("pending")).thenReturn(pending);
        assertEquals(CommunityLoginBlockReason.PENDING_REVIEW, service.evaluateLoginReadiness("pending").reason());

        CommunityUser rejected = activeUser();
        rejected.setStatus("REJECTED");
        when(userMapper.selectById("rejected")).thenReturn(rejected);
        assertEquals(CommunityLoginBlockReason.REJECTED, service.evaluateLoginReadiness("rejected").reason());

        CommunityUser suspended = activeUser();
        suspended.setStatus("SUSPENDED");
        when(userMapper.selectById("suspended")).thenReturn(suspended);
        assertEquals(CommunityLoginBlockReason.SUSPENDED, service.evaluateLoginReadiness("suspended").reason());

        CommunityUser unverified = activeUser();
        unverified.setEmailVerifiedAt(null);
        when(userMapper.selectById("unverified")).thenReturn(unverified);
        assertEquals(CommunityLoginBlockReason.EMAIL_UNVERIFIED, service.evaluateLoginReadiness("unverified").reason());
    }

    @Test
    void ordinaryCommunityRolesAndFounderLikeColumnDoNotGrantStaff() {
        when(userMapper.selectById("u1")).thenReturn(activeUser());
        when(rbacService.listRoleCodes("u1")).thenReturn(List.of("user", "creator", "member"));
        AdminConsoleEligibility eligibility = service.evaluateAdminConsoleEligibility("u1");
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.staffRoleCodes().isEmpty());

        CommunityUser founderLike = activeUser();
        founderLike.setRole("FOUNDER");
        when(userMapper.selectById("founder")).thenReturn(founderLike);
        when(rbacService.listRoleCodes("founder")).thenReturn(List.of());
        assertFalse(service.evaluateAdminConsoleEligibility("founder").eligible());
    }

    @ParameterizedTest
    @ValueSource(strings = {"user", "member", "creator", "operator", "cid3_staff"})
    void nonAdminRolesAreDeniedEvenWhenActive(String roleCode) {
        when(userMapper.selectById("u1")).thenReturn(activeUser());
        when(rbacService.listRoleCodes("u1")).thenReturn(List.of(roleCode));
        AdminConsoleEligibility eligibility = service.evaluateAdminConsoleEligibility("u1");
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.staffRoleCodes().isEmpty());
    }

    @Test
    void unknownRoleCombinedWithOrdinaryRolesIsDenied() {
        when(userMapper.selectById("u1")).thenReturn(activeUser());
        when(rbacService.listRoleCodes("u1")).thenReturn(List.of("user", "cid3_staff", "member"));
        AdminConsoleEligibility eligibility = service.evaluateAdminConsoleEligibility("u1");
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.staffRoleCodes().isEmpty());
    }

    @Test
    void adminOnActiveVerifiedUserIsEligible() {
        CommunityUser user = activeUser();
        user.setEmailVerifiedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(configHelper.isRegisterVerifyEmail()).thenReturn(true);
        when(userMapper.selectById("u1")).thenReturn(user);
        when(rbacService.listRoleCodes("u1")).thenReturn(List.of("user", "admin"));
        AdminConsoleEligibility eligibility = service.evaluateAdminConsoleEligibility("u1");
        assertTrue(eligibility.eligible());
        assertEquals(List.of("admin"), eligibility.staffRoleCodes());
    }

    @Test
    void disabledOrDeletedAdminIsDeniedWhenRbacOmitsIt() {
        when(userMapper.selectById("u1")).thenReturn(activeUser());
        when(rbacService.listRoleCodes("u1")).thenReturn(List.of());
        assertFalse(service.evaluateAdminConsoleEligibility("u1").eligible());
    }

    @Test
    void adminDoesNotOverrideBlockedStatusOrUnverifiedEmail() {
        CommunityUser pending = activeUser();
        pending.setStatus("PENDING_REVIEW");
        when(userMapper.selectById("pending")).thenReturn(pending);
        when(rbacService.listRoleCodes("pending")).thenReturn(List.of("admin"));
        AdminConsoleEligibility pendingEligibility = service.evaluateAdminConsoleEligibility("pending");
        assertFalse(pendingEligibility.eligible());
        assertEquals(List.of("admin"), pendingEligibility.staffRoleCodes());

        when(configHelper.isRegisterVerifyEmail()).thenReturn(true);
        CommunityUser unverified = activeUser();
        unverified.setEmailVerifiedAt(null);
        when(userMapper.selectById("unverified")).thenReturn(unverified);
        when(rbacService.listRoleCodes("unverified")).thenReturn(List.of("admin"));
        AdminConsoleEligibility unverifiedEligibility = service.evaluateAdminConsoleEligibility("unverified");
        assertFalse(unverifiedEligibility.eligible());
        assertEquals(CommunityLoginBlockReason.EMAIL_UNVERIFIED, unverifiedEligibility.loginReadiness().reason());
    }

    @Test
    void passwordMatchesUsesExistingBcryptSupport() {
        CommunityUser user = activeUser();
        user.setPasswordHash(PasswordSupport.hash("Secret123!"));
        when(userMapper.selectById("u1")).thenReturn(user);
        assertTrue(service.passwordMatches("u1", "Secret123!"));
        assertFalse(service.passwordMatches("u1", "wrong"));
        assertFalse(service.passwordMatches("u1", null));
    }

    private static CommunityUser activeUser() {
        CommunityUser user = new CommunityUser();
        user.setId("u1");
        user.setEmail("a@example.com");
        user.setPhone("13800000000");
        user.setStatus("ACTIVE");
        user.setRole("creator");
        user.setCreatedAt(Instant.parse("2026-01-01T00:00:00Z"));
        return user;
    }
}
