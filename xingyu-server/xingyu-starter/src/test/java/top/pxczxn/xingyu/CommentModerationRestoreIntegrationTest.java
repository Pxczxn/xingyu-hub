package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 治理措施对 COMMENT 的隐藏 / 恢复必须回到真实生命周期状态。
 *
 * <p>回归的缺陷：{@code ModerationMeasureExecutor.restoreTarget} 的 COMMENT 分支曾写
 * {@code status = 'ACTIVE'} —— 而 comment 的真实生命周期是 VISIBLE / HIDDEN / DELETED，
 * 且 {@code CommentMapper} 的四个公开查询**全部只认 {@code status = 'VISIBLE'}**。
 * 于是「隐藏 → 申诉批准 → 恢复」之后评论被写进一个死状态，从此在任何地方都不可见。
 *
 * <p>本测试验证的不只是数据库字段：它同时覆盖
 * <ul>
 *   <li>对象评论列表（{@code GET /comments/{type}/{id}}）重新可见；</li>
 *   <li>评论详情（{@code GET /comments/lookup/{id}}）重新可见；</li>
 *   <li>数据库状态确实是 VISIBLE（moderation 状态一致）。</li>
 * </ul>
 * 手工用一个 no-op 的执行器或只改 DB 字段是通不过的。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommentModerationRestoreIntegrationTest {

    private static final String COMMENT_PREFIX = "COMREST-";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
        cleanup();
        adminToken = adminToken();
    }

    @AfterEach
    void tearDown() {
        cleanup();
    }

    private void cleanup() {
        // 只清本类造的数据：以评论正文前缀定位，连带清掉它引用的宿主 moment，
        // 以及由它派生的案件/决定/措施/申诉。
        List<String> commentIds = jdbcTemplate.queryForList(
                "SELECT id FROM comment WHERE body LIKE ?", String.class, COMMENT_PREFIX + "%");
        for (String commentId : commentIds) {
            // 该评论挂在哪个 moment 上 —— moment 表没有正文字段，只能从 comment.object_id 反查。
            List<String> hostMoments = jdbcTemplate.queryForList(
                    "SELECT object_id FROM comment WHERE id = ? AND object_type = 'MOMENT'",
                    String.class, commentId);
            List<String> reportIds = jdbcTemplate.queryForList(
                    "SELECT id FROM report WHERE object_id = ?", String.class, commentId);
            for (String reportId : reportIds) {
                jdbcTemplate.update(
                        "DELETE FROM moderation_measure WHERE decision_id IN "
                                + "(SELECT id FROM moderation_decision WHERE case_id IN "
                                + "(SELECT id FROM moderation_case WHERE report_id = ?))", reportId);
                jdbcTemplate.update(
                        "DELETE FROM moderation_decision WHERE case_id IN "
                                + "(SELECT id FROM moderation_case WHERE report_id = ?)", reportId);
                jdbcTemplate.update("DELETE FROM appeal WHERE case_id IN "
                        + "(SELECT id FROM moderation_case WHERE report_id = ?)", reportId);
                jdbcTemplate.update("DELETE FROM moderation_case WHERE report_id = ?", reportId);
                jdbcTemplate.update("DELETE FROM report_supplement WHERE report_id = ?", reportId);
                jdbcTemplate.update("DELETE FROM report WHERE id = ?", reportId);
            }
            jdbcTemplate.update("DELETE FROM comment WHERE id = ?", commentId);
            for (String momentId : hostMoments) {
                jdbcTemplate.update("DELETE FROM comment WHERE object_type = 'MOMENT' AND object_id = ?", momentId);
                jdbcTemplate.update("DELETE FROM moment WHERE id = ?", momentId);
            }
        }
    }

    @Test
    void hiddenCommentComesBackToTheVisibleLifecycleAfterRestore() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String authorEmail = "comrest" + nonce + "@example.com";
        String authorName = "comrest" + (nonce % 1_000_000_000L);
        String reporterEmail = "comreptr" + nonce + "@example.com";
        String reporterName = "comreptr" + (nonce % 1_000_000_000L);

        register(authorEmail, authorName, password);
        register(reporterEmail, reporterName, password);
        String authorToken = login(authorEmail, password);
        String reporterToken = login(reporterEmail, password);

        // 作者发一条动态，再在动态下留一条评论（真实业务路径创建）。
        String momentId = createMoment(authorToken, COMMENT_PREFIX + "宿主动态");
        String commentId = createComment(authorToken, "MOMENT", momentId, COMMENT_PREFIX + "被治理评论");

        // 治理前置：**另一个用户**举报该评论（自己不能举报自己）→ 管理员认定违规 → 评论被隐藏。
        String reportId = submitReport(reporterToken, "COMMENT", commentId, "SPAM");
        String caseId = caseIdOf(reportId);
        decideReport(caseId, "UPHELD");

        assertEquals("HIDDEN", commentStatus(commentId), "认定违规后评论必须被隐藏");
        assertTrue(commentIdsUnderMoment(momentId, authorToken).isEmpty(), "隐藏后对象评论列表不得再出现该评论");
        mockMvc.perform(get("/api/v1/comments/lookup/" + commentId).header("satoken", authorToken))
                .andExpect(status().isNotFound());

        // 受影响的 owner（评论作者）对措施提出申诉；管理员批准。
        String measureId = latestMeasureId(caseId);
        String appealId = submitAppeal(authorToken, caseId, measureId, "这条评论没有违规");
        decideAppeal(appealId, "APPROVED");

        // 恢复后必须回到真实生命周期状态 VISIBLE —— 不是 ACTIVE 这类没人读的值。
        assertEquals("VISIBLE", commentStatus(commentId),
                "恢复后的评论状态必须是 VISIBLE（comment 生命周期只认 VISIBLE/HIDDEN/DELETED）");

        // 真正的可见性回归：列表与详情都必须重新可见，不只是 DB 字段变了。
        assertTrue(commentIdsUnderMoment(momentId, authorToken).contains(commentId),
                "恢复后该评论必须重新出现在对象评论列表中");
        mockMvc.perform(get("/api/v1/comments/lookup/" + commentId).header("satoken", authorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(commentId));
    }

    // ---- HTTP helpers ----

    private void register(String email, String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String createMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String createComment(String token, String objectType, String objectId, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","body":"%s"}
                                """.formatted(objectType, objectId, body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String submitReport(String token, String objectType, String objectId, String reason) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"%s"}
                                """.formatted(objectType, objectId, reason)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
    }

    private void decideReport(String caseId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    private String submitAppeal(String token, String caseId, String measureId, String detail) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"%s"}
                                """.formatted(caseId, measureId, detail)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private void decideAppeal(String appealId, String decision) throws Exception {
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    // ---- DB probes ----

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    private List<String> commentIdsUnderMoment(String momentId, String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/comments/MOMENT/" + momentId)
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode array = objectMapper.readTree(result.getResponse().getContentAsString());
        List<String> ids = new java.util.ArrayList<>();
        array.forEach(node -> ids.add(node.path("id").asText()));
        return ids;
    }

    private String caseIdOf(String reportId) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
    }

    private String latestMeasureId(String caseId) {
        return jdbcTemplate.queryForObject(
                "SELECT mm.id FROM moderation_measure mm "
                        + "JOIN moderation_decision md ON md.id = mm.decision_id "
                        + "WHERE md.case_id = ? ORDER BY mm.created_at DESC LIMIT 1",
                String.class, caseId);
    }
}
