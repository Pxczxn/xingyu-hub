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

    private Long adminRole;
    private Long ordinaryUserRole;
    private Long memberRole;
    private Long creatorRole;
    private Long unknownRole;
    private Long disabledRole;
    private Long deletedRole;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        adminRole = jdbcTemplate.queryForObject("SELECT id FROM sys_role WHERE code = 'admin' LIMIT 1", Long.class);
        ordinaryUserRole = jdbcTemplate.queryForObject("SELECT id FROM sys_role WHERE code = 'user' LIMIT 1", Long.class);
        memberRole = insertRole("member", 1, 0);
        creatorRole = insertRole("creator", 1, 0);
        unknownRole = insertRole("cid31_unknown", 1, 0);
        disabledRole = insertRole("cid31_disabled", 0, 0);
        deletedRole = insertRole("cid31_deleted", 1, 1);
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
    void adminOnActiveVerifiedUserIsEligible() {
        String staffUser = insertUser("ACTIVE", "user", true);
        grant(staffUser, adminRole);
        grant(staffUser, ordinaryUserRole);
        AdminConsoleEligibility eligibility = communityIdentityService.evaluateAdminConsoleEligibility(staffUser);
        assertTrue(eligibility.eligible());
        assertEquals(List.of("admin"), eligibility.staffRoleCodes());
    }

    @Test
    void memberCreatorUnknownAndMixedRolesAreDenied() {
        String member = insertUser("ACTIVE", "member", true);
        grant(member, memberRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(member).eligible());

        String creator = insertUser("ACTIVE", "creator", true);
        grant(creator, creatorRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(creator).eligible());

        String unknown = insertUser("ACTIVE", "user", true);
        grant(unknown, unknownRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(unknown).eligible());

        String mixed = insertUser("ACTIVE", "user", true);
        grant(mixed, ordinaryUserRole);
        grant(mixed, unknownRole);
        grant(mixed, memberRole);
        AdminConsoleEligibility mixedEligibility = communityIdentityService.evaluateAdminConsoleEligibility(mixed);
        assertFalse(mixedEligibility.eligible());
        assertTrue(mixedEligibility.staffRoleCodes().isEmpty());
    }

    @Test
    void founderLikeCommunityRoleWithoutAdminGrantIsNotEligible() {
        String founderLike = insertUser("ACTIVE", "FOUNDER", true);
        grant(founderLike, ordinaryUserRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(founderLike).eligible());
    }

    @Test
    void disabledOrDeletedAdminGrantIsDenied() {
        String disabledHolder = insertUser("ACTIVE", "user", true);
        grant(disabledHolder, disabledRole);
        grant(disabledHolder, deletedRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(disabledHolder).eligible());

        String adminHolder = insertUser("ACTIVE", "user", true);
        grant(adminHolder, adminRole);
        jdbcTemplate.update("UPDATE sys_role SET status = 0 WHERE id = ?", adminRole);
        try {
            assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(adminHolder).eligible());
        } finally {
            jdbcTemplate.update("UPDATE sys_role SET status = 1, deleted = 0 WHERE id = ?", adminRole);
        }

        jdbcTemplate.update("UPDATE sys_role SET deleted = 1 WHERE id = ?", adminRole);
        try {
            assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(adminHolder).eligible());
        } finally {
            jdbcTemplate.update("UPDATE sys_role SET status = 1, deleted = 0 WHERE id = ?", adminRole);
        }
    }

    @Test
    void pendingOrUnverifiedAdminIsDenied() {
        String pending = insertUser("PENDING_REVIEW", "user", true);
        grant(pending, adminRole);
        assertFalse(communityIdentityService.evaluateAdminConsoleEligibility(pending).eligible());

        String unverified = insertUser("ACTIVE", "user", false);
        grant(unverified, adminRole);
        configGroupService.saveConfig(
                "register",
                "{\"enabled\":true,\"verifyEmail\":true,\"verifyPhone\":false,\"defaultRole\":\"user\",\"needAudit\":false}");
        configGroupService.refreshCache();
        AdminConsoleEligibility eligibility = communityIdentityService.evaluateAdminConsoleEligibility(unverified);
        assertFalse(eligibility.eligible());
        assertEquals(CommunityLoginBlockReason.EMAIL_UNVERIFIED, eligibility.loginReadiness().reason());
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
