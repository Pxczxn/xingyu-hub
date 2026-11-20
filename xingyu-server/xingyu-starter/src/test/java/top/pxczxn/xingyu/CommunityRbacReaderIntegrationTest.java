package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import top.pxczxn.xingyu.system.rbac.CommunityGrantedRole;
import top.pxczxn.xingyu.system.service.CommunityRbacService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class CommunityRbacReaderIntegrationTest {

    @Autowired
    private CommunityRbacService communityRbacService;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private final List<String> communityUserIds = new ArrayList<>();
    private final List<Long> roleIds = new ArrayList<>();
    private final List<Long> menuIds = new ArrayList<>();

    private String userA;
    private String userB;
    private Long enabledRole;
    private Long otherRole;
    private Long disabledRole;
    private Long deletedRole;

    @BeforeEach
    void setUp() {
        userA = insertCommunityUser("crbaca");
        userB = insertCommunityUser("crbacb");
        enabledRole = insertRole("crbac_enabled", 1, 0);
        otherRole = insertRole("crbac_other", 1, 0);
        disabledRole = insertRole("crbac_disabled", 0, 0);
        deletedRole = insertRole("crbac_deleted", 1, 1);
        Long listMenu = insertMenu("crbac:user:list", 1, 0);
        Long addMenu = insertMenu("crbac:user:add", 1, 0);
        Long emptyPerm = insertMenu("", 1, 0);
        Long disabledMenu = insertMenu("crbac:user:disabled", 0, 0);
        Long deletedMenu = insertMenu("crbac:user:gone", 1, 1);
        grantMenu(enabledRole, listMenu);
        grantMenu(enabledRole, addMenu);
        grantMenu(enabledRole, emptyPerm);
        grantMenu(enabledRole, disabledMenu);
        grantMenu(enabledRole, deletedMenu);
        grantMenu(otherRole, listMenu);
        grantMenu(disabledRole, listMenu);
        grantMenu(deletedRole, addMenu);
        grantRole(userA, enabledRole);
        grantRole(userA, otherRole);
        grantRole(userA, disabledRole);
        grantRole(userA, deletedRole);
        grantRole(userB, otherRole);
    }

    @AfterEach
    void tearDown() {
        for (String userId : communityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
        }
        for (Long roleId : roleIds) {
            jdbcTemplate.update("DELETE FROM sys_role_menu WHERE role_id = ?", roleId);
            jdbcTemplate.update("DELETE FROM sys_role WHERE id = ?", roleId);
        }
        for (Long menuId : menuIds) {
            jdbcTemplate.update("DELETE FROM sys_role_menu WHERE menu_id = ?", menuId);
            jdbcTemplate.update("DELETE FROM sys_menu WHERE id = ?", menuId);
        }
        for (String userId : communityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
    }

    @Test
    void userWithoutRolesGetsEmptyGrants() {
        String lone = insertCommunityUser("crbacnone");
        assertEquals(List.of(), communityRbacService.listRoles(lone));
        assertEquals(List.of(), communityRbacService.listPermissions(lone));
    }

    @Test
    void enabledRolesAndMergedDistinctPermissionsAreReturned() {
        List<String> codes = communityRbacService.listRoleCodes(userA);
        assertEquals(List.of("crbac_enabled", "crbac_other"), codes);
        List<String> permissions = communityRbacService.listPermissions(userA);
        assertEquals(List.of("crbac:user:add", "crbac:user:list"), permissions.stream().sorted().toList());
        assertTrue(communityRbacService.hasRole(userA, "crbac_enabled"));
        assertTrue(communityRbacService.hasPermission(userA, "crbac:user:list"));
        assertFalse(communityRbacService.hasPermission(userA, "crbac:user:disabled"));
        assertFalse(communityRbacService.hasPermission(userA, "crbac:user:gone"));
    }

    @Test
    void usersAreIsolatedAndUnknownIdIsEmpty() {
        assertEquals(List.of("crbac_other"), communityRbacService.listRoleCodes(userB));
        assertEquals(List.of("crbac:user:list"), communityRbacService.listPermissions(userB));
        assertFalse(communityRbacService.hasRole(userB, "crbac_enabled"));
        String missing = UUID.randomUUID().toString();
        assertEquals(List.of(), communityRbacService.listRoles(missing));
        assertEquals(List.of(), communityRbacService.listPermissions(missing));
    }

    @Test
    void grantedRoleObjectsDoNotExposeDataScopeAsEntitlement() {
        List<CommunityGrantedRole> roles = communityRbacService.listRoles(userA);
        assertEquals(2, roles.size());
        assertTrue(roles.stream().allMatch(role -> role.getCode() != null && role.getId() != null));
    }

    private String insertCommunityUser(String prefix) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_user (id, email, password_hash, status, role, terms_version, created_at)
                VALUES (?, ?, 'x', 'ACTIVE', 'creator', '1.0', NOW())
                """, id, prefix + id.substring(0, 8) + "@example.com");
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

    private Long insertMenu(String permission, int status, int deleted) {
        jdbcTemplate.update("""
                INSERT INTO sys_menu (parent_id, name, type, path, permission, sort, visible, status, is_frame, deleted)
                VALUES (0, ?, 3, NULL, ?, 1, 1, ?, 0, ?)
                """, permission.isBlank() ? "crbac-empty" : permission, permission, status, deleted);
        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        menuIds.add(id);
        return id;
    }

    private void grantMenu(Long roleId, Long menuId) {
        jdbcTemplate.update("INSERT INTO sys_role_menu (role_id, menu_id) VALUES (?, ?)", roleId, menuId);
    }

    private void grantRole(String communityUserId, Long roleId) {
        jdbcTemplate.update("""
                INSERT INTO community_user_role (id, community_user_id, role_id, created_at)
                VALUES (?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), communityUserId, roleId);
    }
}
