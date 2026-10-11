package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 星系成员退出闭环回归（2026-10-10 Galaxy Membership Closure）。
 *
 * <p>语义以真实模型为准：galaxy 表无 owner 字段，成员 role 当前只有 MEMBER；
 * leave 对非 MEMBER 角色 409（未来引入 ADMIN/OWNER 即被守卫拦截），非成员
 * （含重复退出）404，未登录 401。memberCount 为实时 COUNT(*)。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GalaxyLeaveIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> galaxyIds = new ArrayList<>();

    private String token;
    private String otherToken;
    private String adminToken;
    private String openGalaxySlug;
    private String approvalGalaxySlug;
    private String approvalGalaxyId;
    private String roleGuardGalaxySlug;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = seedUser("glv-a");
        otherToken = seedUser("glv-b");
        openGalaxySlug = seedGalaxy("OPEN", null);
        approvalGalaxyId = UUID.randomUUID().toString();
        approvalGalaxySlug = seedGalaxy("APPROVAL", approvalGalaxyId);
        roleGuardGalaxySlug = seedGalaxy("OPEN", null);
        // role 守卫 fixture：先建 ADMIN 账号再插一行 ADMIN 成员（当前代码无 ADMIN 赋值路径）
        adminToken = seedUser("glv-admin");
        String adminUserId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email LIKE 'glv-admin%'", String.class);
        jdbcTemplate.update("""
                INSERT INTO galaxy_member (id, galaxy_id, user_id, role, joined_at)
                SELECT ?, g.id, ?, 'ADMIN', NOW() FROM galaxy g WHERE g.slug = ?
                """, UUID.randomUUID().toString(), adminUserId, roleGuardGalaxySlug);
    }

    @AfterAll
    void tearDown() {
        for (String gid : galaxyIds) {
            jdbcTemplate.update("DELETE FROM galaxy_member WHERE galaxy_id = ?", gid);
            jdbcTemplate.update("DELETE FROM galaxy_join_request WHERE galaxy_id = ?", gid);
            jdbcTemplate.update("DELETE FROM galaxy WHERE id = ?", gid);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        galaxyIds.clear();
    }

    // ---- 验收矩阵 ----

    @Test
    @Order(1)
    void memberJoinsThenLeavesAndCountDrops() throws Exception {
        mockMvc.perform(post("/api/v1/galaxies/" + openGalaxySlug + "/join").header("satoken", token))
                .andExpect(status().isOk());
        long before = memberCount(openGalaxySlug);

        mockMvc.perform(delete("/api/v1/galaxies/" + openGalaxySlug + "/members").header("satoken", token))
                .andExpect(status().isNoContent());

        long after = memberCount(openGalaxySlug);
        assertEquals(before - 1, after, "退出后 memberCount 必须减一（实时 COUNT）");
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_member gm JOIN galaxy g ON g.id = gm.galaxy_id "
                        + "WHERE g.slug = ? AND gm.user_id = (SELECT id FROM community_user WHERE email LIKE 'glv-a-%')",
                Integer.class, openGalaxySlug);
        assertEquals(0, rows, "成员行必须被删除");
    }

    @Test
    @Order(2)
    void nonMemberAndRepeatedLeaveAreNotFound() throws Exception {
        // 从未加入的其他用户、以及退出后的重复退出，语义一致：404
        mockMvc.perform(delete("/api/v1/galaxies/" + openGalaxySlug + "/members").header("satoken", token))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/galaxies/" + approvalGalaxySlug + "/members").header("satoken", otherToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(3)
    void unauthenticatedLeaveIsUnauthorized() throws Exception {
        mockMvc.perform(delete("/api/v1/galaxies/" + openGalaxySlug + "/members"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(4)
    void nonMemberRoleCannotLeave() throws Exception {
        // role 守卫：ADMIN 角色不得自主退出（当前代码无赋值路径，fixture 直接置行）
        mockMvc.perform(delete("/api/v1/galaxies/" + roleGuardGalaxySlug + "/members")
                        .header("satoken", adminToken))
                .andExpect(status().isConflict());
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_member gm JOIN galaxy g ON g.id = gm.galaxy_id "
                        + "WHERE g.slug = ? AND gm.role = 'ADMIN'",
                Integer.class, roleGuardGalaxySlug);
        assertEquals(1, rows, "守卫必须拒绝且不删除行");
    }

    @Test
    @Order(5)
    void rejoinFollowsExistingOpenAndApprovalMechanics() throws Exception {
        // OPEN：退出后可直join
        mockMvc.perform(post("/api/v1/galaxies/" + openGalaxySlug + "/join").header("satoken", token))
                .andExpect(status().isOk());
        assertEquals(1, memberRowsOf(openGalaxySlug, "glv-a"));
        mockMvc.perform(delete("/api/v1/galaxies/" + openGalaxySlug + "/members").header("satoken", token))
                .andExpect(status().isNoContent());

        // APPROVAL：退出后重新加入必须走申请（join 409 → apply PENDING）
        mockMvc.perform(post("/api/v1/galaxies/" + approvalGalaxySlug + "/join").header("satoken", otherToken))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/v1/galaxies/" + approvalGalaxySlug + "/apply")
                        .header("satoken", otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"message\":\"rejoin request\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    // ---- helpers ----

    private long memberCount(String slug) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/galaxies/" + slug))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
                .readTree(body).path("memberCount").asLong();
    }

    private int memberRowsOf(String slug, String emailPrefix) {
        Integer n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_member gm JOIN galaxy g ON g.id = gm.galaxy_id "
                        + "JOIN community_user u ON u.id = gm.user_id "
                        + "WHERE g.slug = ? AND u.email LIKE ?",
                Integer.class, slug, emailPrefix + "%");
        return n == null ? 0 : n;
    }

    private String seedUser(String prefix) throws Exception {
        String email = prefix + "-" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + "-space-" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + (System.nanoTime() % 1_000_000_000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String seedGalaxy(String joinMode, String fixedId) {
        String id = fixedId == null ? UUID.randomUUID().toString() : fixedId;
        long nonce = System.nanoTime() % 100000000L;
        jdbcTemplate.update("""
                INSERT INTO galaxy (id, seed_key, slug, name, official, join_mode)
                VALUES (?, ?, ?, ?, 0, ?)
                """, id, "glv-seed-" + nonce, "glv-" + joinMode.toLowerCase() + "-" + nonce,
                "退出回归-" + joinMode, joinMode);
        galaxyIds.add(id);
        return (String) ("glv-" + joinMode.toLowerCase() + "-" + nonce);
    }
}
