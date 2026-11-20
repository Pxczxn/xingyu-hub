package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.community.identity.AdminConsoleEligibility;
import top.pxczxn.xingyu.community.identity.CommunityIdentityService;
import top.pxczxn.xingyu.community.identity.CommunityIdentityView;
import top.pxczxn.xingyu.community.identity.CommunityLoginBlockReason;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class CommunityIdentityEligibilityIntegrationTest {

    private static final String PASSWORD = "Secret123!";

    @Autowired
    private CommunityIdentityService communityIdentityService;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> communityUserIds = new ArrayList<>();
    private final List<Long> roleIds = new ArrayList<>();

    private Long staffRole;
    private Long ordinaryUserRole;
    private Long disabledRole;
    private Long deletedRole;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        staffRole = insertRole("cid3_staff", 1, 0);
        ordinaryUserRole = jdbcTemplate.queryForObject("SELECT id FROM sys_role WHERE code = 'user' LIMIT 1", Long.class);
        disabledRole = insertRole("cid3_disabled", 0, 0);
        deletedRole = insertRole("cid3_deleted", 1, 1);
    }

    @AfterEach
    void tearDown() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        for (String userId : communityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
        }
        for (Long roleId : roleIds) {
            jdbcTemplate.update("DELETE FROM sys_role_menu WHERE role_id = ?", roleId);
            jdbcTemplate.update("DELETE FROM sys_role WHERE id = ?", roleId);
        }
        for (String userId : communityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
    }

    @Test
    void activeUserIdentityIsReadableWithoutPasswordHash() {
        String id = insertUser("ACTIVE", "creator", true);
        Optional<CommunityIdentityView> view = communityIdentityService.findById(id);
        assertTrue(view.isPresent());
        assertEquals(id, view.get().id());
        assertEquals("ACTIVE", view.get().status());
        assertTrue(view.get().emailVerified());
        assertTrue(communityIdentityService.evaluateLoginReadiness(id).allowed());
        assertTrue(communityIdentityService.passwordMatches(id, PASSWORD));
        assertFalse(communityIdentityService.passwordMatches(id, "wrong-password"));
    }

    @Test
    void statusAndEmailGatesMatchLoginSemantics() {
        String pending = insertUser("PENDING_REVIEW", "user", true);
        String rejected = insertUser("REJECTED", "user", true);
        String suspended = insertUser("SUSPENDED", "user", true);
        String unverified = insertUser("ACTIVE", "user", false);
        assertEquals(
                CommunityLoginBlockReason.PENDING_REVIEW,
                communityIdentityService.evaluateLoginReadiness(pending).reason());
        assertEquals(
                CommunityLoginBlockReason.REJECTED,
                communityIdentityService.evaluateLoginReadiness(rejected).reason());
        assertEquals(
                CommunityLoginBlockReason.SUSPENDED,
                communityIdentityService.evaluateLoginReadiness(suspended).reason());
        assertTrue(communityIdentityService.evaluateLoginReadiness(unverified).allowed());

        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":true,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.refreshCache();
        assertEquals(
                CommunityLoginBlockReason.EMAIL_UNVERIFIED,
                communityIdentityService.evaluateLoginReadiness(unverified).reason());
    }

    @Test
    void missingUuidAndOrdinaryRolesAreNotStaff() {
        String missing = UUID.randomUUID().toString();
        assertTrue(communityIdentityService.findById(missing).isEmpty());
        assertEquals(
                CommunityLoginBlockReason.NOT_FOUND,
                communityIdentityService.evaluateLoginReadiness(missing).reason());

        String ordinary = insertUser("ACTIVE", "member", true);
        grant(ordinary, ordinaryUserRole);
        AdminConsoleEligibility ordinaryEligibility = communityIdentityService.evaluateAdminConsoleEligibility(ordinary);
        assertFalse(ordinaryEligibility.eligible());
        assertTrue(ordinaryEligibility.staffRoleCodes().isEmpty());
    }

    @Test
    void founderLikeCommunityRoleWithoutStaffGrantIsNotEligible() {
        String founderLike = insertUser("ACTIVE", "FOUNDER", true);
        grant(founderLike, ordinaryUserRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(founderLike).eligible());
    }

    @Test
    void staffGrantOnActiveUserIsEligibleAndDisabledRolesDoNotCount() {
        String staffUser = insertUser("ACTIVE", "user", true);
        grant(staffUser, staffRole);
        grant(staffUser, ordinaryUserRole);
        AdminConsoleEligibility eligibility = communityIdentityService.evaluateAdminConsoleEligibility(staffUser);
        assertTrue(eligibility.eligible());
        assertEquals(List.of("cid3_staff"), eligibility.staffRoleCodes());

        String onlyDisabled = insertUser("ACTIVE", "user", true);
        grant(onlyDisabled, disabledRole);
        grant(onlyDisabled, deletedRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(onlyDisabled).eligible());
    }

    private String insertUser(String status, String communityRole, boolean emailVerified) {
        String id = UUID.randomUUID().toString();
        String email = "cid3" + id.substring(0, 8) + "@example.com";
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, status, role, terms_version, created_at, email_verified_at)
                VALUES (?, ?, ?, ?, ?, '1.0', NOW(), ?)
                """, id, email, PasswordSupport.hash(PASSWORD), status, communityRole,
                emailVerified ? java.sql.Timestamp.from(java.time.Instant.parse("2026-01-01T00:00:00Z")) : null);
        communityUserIds.add(id);
        return id;
    }

    private Long insertRole(String code, int status, int deleted) {
        jdbcTemplate.update("""
                INSERT INTO sys_role (name, code, sort, status, remark, deleted, data_scope)
                VALUES (?, ?, 1, ?, NULL, ?, 1)
                """, code, code, status, deleted);
        Long id = jdbcTemplate.queryForObject("SELECT id FROM sys_role WHERE code = ?", Long.class, code);
        roleIds.add(id);
        return id;
    }

    private void grant(String communityUserId, Long roleId) {
        jdbcTemplate.update("""
                INSERT INTO community_user_role (id, community_user_id, role_id, created_at)
                VALUES (?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), communityUserId, roleId);
    }
}
