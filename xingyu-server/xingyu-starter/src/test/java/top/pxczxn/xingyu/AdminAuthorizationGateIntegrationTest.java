package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Admin Security Gate Recovery 授权矩阵回归（2026-10-10）。
 *
 * <p>背景（见 docs/admin-authorization-governance-audit-2026-10-10.md）：admin-api 被 AOP
 * CGLIB 代理后方法注解丢失，@SaCheckPermission 全体静默失效，role=user 账号可真实批准文章。
 * 修复：SaTokenConfig 对社区治理域路径统一 checkRole("admin")（运行时断言，免疫代理丢注解）。
 * 本测试钉死授权矩阵，防止回退。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminAuthorizationGateIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<Long> sysUserIds = new ArrayList<>();
    private final List<String> communityUserIds = new ArrayList<>();

    private String adminToken;
    private String lowToken;
    private String nullTypeToken;
    private String communityToken;
    private String submissionId;
    private String articleId;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        sysUserIds.clear();
        communityUserIds.clear();
        adminToken = adminLogin();
        lowToken = seedSysUser("gate low", "admin", 2L);
        nullTypeToken = seedSysUser("gate null", null, null);
        communityToken = seedCommunityUser();
        String[] ids = createPendingSubmission();
        articleId = ids[0];
        submissionId = ids[1];
    }

    @AfterAll
    void tearDown() {
        // fixture 清理：社区作者文章全链 + sys fixture 账号
        for (String userId : communityUserIds) {
            jdbcTemplate.update("""
                    DELETE wd FROM working_draft wd
                    JOIN article a ON a.id = wd.article_id WHERE a.owner_id = ?
                    """, userId);
            jdbcTemplate.update("DELETE pr FROM published_revision pr JOIN article a ON a.id = pr.article_id WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE rd FROM review_decision rd JOIN review_submission rs ON rd.submission_id = rs.id JOIN article a ON a.id = rs.article_id WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE rs FROM review_submission rs JOIN article a ON a.id = rs.article_id WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE fr FROM formal_revision fr JOIN article a ON a.id = fr.article_id WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE sd FROM search_document sd JOIN article a ON sd.object_id = a.id AND sd.object_type = 'ARTICLE' WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE at2 FROM article_topic at2 JOIN article a ON a.id = at2.article_id WHERE a.owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM article WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        for (Long userId : sysUserIds) {
            jdbcTemplate.update("DELETE FROM sys_user_role WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM sys_user WHERE id = ?", userId);
        }
        communityUserIds.clear();
        sysUserIds.clear();
    }

    // ---- 授权矩阵 ----

    @Test
    @Order(1)
    void authorizationMatrixBlocksLowPrivilegeAndCommunityTokens() throws Exception {
        // 管理端错误响应为 HTTP 200 + body.code（与 curl 实测一致），断言业务码而非 HTTP 状态。
        // 未登录 / 社区 token：checkLogin 层拒绝
        mockMvc.perform(get("/api/v1/admin/review/queue"))
                .andExpect(jsonPath("$.code").value(401));
        mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", communityToken))
                .andExpect(jsonPath("$.code").value(401));

        // 低权限 sys_user（role=user）与无角色 sys_user：治理域 403，拒绝先于业务
        mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", lowToken))
                .andExpect(jsonPath("$.code").value(403));
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", lowToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"must-deny\"}"))
                .andExpect(jsonPath("$.code").value(403));
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", nullTypeToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"must-deny\"}"))
                .andExpect(jsonPath("$.code").value(403));
        mockMvc.perform(post("/api/v1/admin/moderation/reports/" + submissionId + "/decide")
                        .header("satoken", lowToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(403));
        mockMvc.perform(get("/api/v1/admin/moderation/appeals").header("satoken", lowToken))
                .andExpect(jsonPath("$.code").value(403));
    }

    @Test
    @Order(2)
    void lowPrivilegeDecideLeavesZeroDatabaseSideEffects() throws Exception {
        Integer before = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_decision WHERE submission_id = ?", Integer.class, submissionId);
        // submit 时本身会冻结一份 formal_revision（送审快照，业务行为）
        Integer formalBefore = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM formal_revision WHERE article_id = ?", Integer.class, articleId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", lowToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"must-deny\"}"))
                .andExpect(jsonPath("$.code").value(403));
        Integer after = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM review_decision WHERE submission_id = ?", Integer.class, submissionId);
        assertEquals(0, after, "被拒请求不得产生 review_decision 行");
        assertEquals(before, after);

        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId);
        assertEquals("IN_REVIEW", status, "article 不得因被拒请求改变状态（提交后本为 IN_REVIEW）");
        Integer formalAfter = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM formal_revision WHERE article_id = ?", Integer.class, articleId);
        assertEquals(formalBefore, formalAfter, "formal_revision 不得因被拒请求新增");
    }

    @Test
    @Order(3)
    void legitimateAdminCanStillDecide() throws Exception {
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"legit\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId);
        assertEquals("PUBLISHED", status, "合法管理员的正常审批链路不得被封死");
        String decidedBy = jdbcTemplate.queryForObject(
                "SELECT decided_by FROM review_decision WHERE submission_id = ?", String.class, submissionId);
        assertEquals("1", decidedBy, "decision 的处理人必须是真实管理员");
    }

    // ---- helpers ----

    private String adminLogin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    /** 建 sys_user（userType 可空、可绑角色）并返回其 sa-token。 */
    private String seedSysUser(String prefix, String userType, Long roleId) throws Exception {
        long id = 99000L + sysUserIds.size() + 1;
        jdbcTemplate.update("DELETE FROM sys_user_role WHERE user_id = ?", id);
        jdbcTemplate.update("DELETE FROM sys_user WHERE id = ?", id);
        String adminPasswordHash = jdbcTemplate.queryForObject(
                "SELECT password FROM sys_user WHERE id = 1", String.class);
        jdbcTemplate.update("""
                INSERT INTO sys_user (id, username, password, nickname, user_type, status)
                VALUES (?, ?, ?, ?, ?, 1)
                """, id, prefix + id, adminPasswordHash, prefix + "-nick", userType);
        if (roleId != null) {
            jdbcTemplate.update("INSERT INTO sys_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        }
        sysUserIds.add(id);
        MvcResult login = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + prefix + id + "\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(login.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String seedCommunityUser() throws Exception {
        String email = "gate" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        communityUserIds.add(userId);
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
                "gate-space-" + (System.nanoTime() % 100000000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    /** 社区作者建文提交，返回 [articleId, submissionId]。 */
    private String[] createPendingSubmission() throws Exception {
        String email = "gateauthor" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        communityUserIds.add(userId);
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
                "gate-author-" + (System.nanoTime() % 100000000L));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = login.getResponse().getHeader("satoken");

        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", token))
                .andReturn();
        String body = created.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(created.getResponse().getStatus() == 200,
                "create article status=" + created.getResponse().getStatus() + " body=" + body);
        String aid = objectMapper.readTree(body).path("articleId").asText();
        assertTrue(!aid.isBlank(), "create article must return articleId, body=" + body);
        mockMvc.perform(put("/api/v1/me/articles/" + aid + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"授权矩阵样本\",\"bodyMode\":\"MARKDOWN\","
                                + "\"body\":\"body\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        MvcResult submitted = mockMvc.perform(post("/api/v1/me/articles/" + aid + "/submit")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        String sid = objectMapper.readTree(submitted.getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .path("submissionId").asText();
        assertTrue(!sid.isBlank());
        return new String[]{aid, sid};
    }
}
