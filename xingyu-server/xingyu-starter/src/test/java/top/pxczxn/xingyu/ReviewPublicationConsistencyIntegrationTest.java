package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 审核批准与发布一致性验证（Phase 7-F Phase A，2026-10-11）。
 *
 * <p>场景（全部走真实 HTTP）：
 * <ol>
 *   <li>首投 → 批准 → article=PUBLISHED、published_revision 存在、
 *       formal_revision_id 与 submission 一致、公开索引 live；</li>
 *   <li>已发布文章修改 → 再次投稿 → 批准 → 新版本发布（published_revision
 *       版本推进、索引内容更新）；</li>
 *   <li>APPROVED 时三表（article / published_revision / review_submission）
 *       状态与引用一致；</li>
 *   <li>重复 decide：第二次必须被拒绝或幂等（不得二次发布、不得改写状态）；</li>
 *   <li>并发 decide：同一 submission 两个并发请求恰好一个成功。</li>
 * </ol>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ReviewPublicationConsistencyIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private top.pxczxn.xingyu.system.service.SysConfigGroupService configGroupService;

    private String authorToken;
    private String authorId;
    private String adminToken;
    private String spaceId;
    private String articleId;

    @BeforeAll
    void seed() throws Exception {
        top.pxczxn.xingyu.CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        authorId = UUID.randomUUID().toString();
        spaceId = UUID.randomUUID().toString();
        String email = "rpcons-" + System.nanoTime() + "@example.com";
        jdbcTemplate.update("""
                INSERT INTO community_user (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, authorId, email, top.pxczxn.xingyu.community.support.PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, '一致性探针', NOW())
                """, spaceId, authorId, "rpcons-space");
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, 'rpcons_author', 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), authorId);
        // 作者登录 token（注册即有 active 会话？——直接登录拿 token）
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        authorToken = login.getResponse().getHeader("satoken");

        MvcResult adminLogin = mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .post("/api/v1/admin/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        adminToken = objectMapper.readTree(adminLogin.getResponse()
                .getContentAsString()).path("data").path("token").asText();
    }

    @AfterAll
    void cleanup() {
        if (articleId != null) {
            jdbcTemplate.update("DELETE FROM search_document WHERE object_type='ARTICLE' AND object_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id = ?)", articleId);
            jdbcTemplate.update("DELETE FROM review_submission WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM working_draft WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        }
        jdbcTemplate.update("DELETE FROM community_session WHERE user_id IN (SELECT user_id FROM community_profile WHERE username = 'rpcons_author')");
        jdbcTemplate.update("DELETE FROM community_profile WHERE username = 'rpcons_author'");
        jdbcTemplate.update("DELETE FROM community_creation_space WHERE slug = 'rpcons-space'");
        jdbcTemplate.update("DELETE FROM community_user WHERE email LIKE 'rpcons-%'");
    }

    /** 建壳 → 保存草稿（含正文）→ 投稿；返回 submissionId。 */
    private String submitArticle(String title) throws Exception {
        MvcResult shell = mockMvc.perform(post("/api/v1/me/articles").header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        articleId = objectMapper.readTree(shell.getResponse().getContentAsString()).path("articleId").asText();

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"description\":\"一致性验收\","
                                + "\"body\":\"# 正文\\n\\n一致性验收内容。\"}"))
                .andExpect(status().isOk());

        MvcResult submit = mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(submit.getResponse().getContentAsString())
                .path("submissionId").asText(null);
    }

    /** decide 并断言业务 code==200（管理端错误为 HTTP 200 + envelope code）。 */
    private void approve(String submissionId) throws Exception {
        var result = mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk())
                .andReturn();
        int bodyCode = objectMapper.readTree(result.getResponse()
                .getContentAsString()).path("code").asInt(200);
        assertEquals(200, bodyCode, "decide 业务失败：" + result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String articleStatus() {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private int publishedRevisionCount() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM published_revision WHERE article_id = ?",
                Integer.class, articleId);
    }

    private String submissionFormalRevisionId() {
        return jdbcTemplate.queryForObject(
                "SELECT formal_revision_id FROM review_submission WHERE article_id = ? "
                        + "ORDER BY submitted_at DESC LIMIT 1", String.class, articleId);
    }

    private int liveDocCount() {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type='ARTICLE' AND object_id = ? "
                        + "AND removed_at IS NULL", Integer.class, articleId);
    }

    /** PUBLICATION_SUCCEEDED 为异步可靠事件——轮询等待索引最终一致。 */
    private void awaitIndexConsistency() throws Exception {
        for (int i = 0; i < 15; i++) {
            if (liveDocCount() > 0) return;
            Thread.sleep(1000);
        }
    }

    @Test
    void firstSubmissionApprovePublishesConsistently() throws Exception {
        String submissionId = submitArticle("一致性首投");
        assertNotNull(submissionId, "submit 必须返回 submissionId");
        approve(submissionId);

        assertEquals("PUBLISHED", articleStatus(), "批准后 article 必须 PUBLISHED");
        assertEquals(1, publishedRevisionCount(), "必须恰好一个发布版本");
        assertEquals(submissionFormalRevisionId(),
                jdbcTemplate.queryForObject(
                        "SELECT formal_revision_id FROM published_revision WHERE article_id = ?",
                        String.class, articleId),
                "published_revision.formal_revision_id 必须与 submission 一致");
        awaitIndexConsistency();
        System.out.println("[PROBE] articleId=" + articleId + " live=" + liveDocCount()
                + " docRows=" + jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM search_document WHERE object_id = ?", Integer.class, articleId)
                + " eventRows=" + jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM reliable_event WHERE event_id LIKE 'publication:%'",
                    Integer.class));
        assertEquals(1, liveDocCount(), "公开索引必须有活文档");
    }

    @Test
    void resubmitAfterEditPublishesNewVersion() throws Exception {
        // 已发布文章编辑 → 再次投稿 → 批准 → 新版本发布
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"一致性首投（修订）\",\"description\":\"一致性验收\","
                                + "\"body\":\"# 正文\\n\\n修订后的内容。\"}"))
                .andExpect(status().isOk());
        String submissionId = submitArticle("一致性首投（修订）");
        approve(submissionId);

        assertEquals("PUBLISHED", articleStatus());
        // published_revision 按 article 单行、批准时推进 formal_revision_id（非累加行）
        String expectedFormal = submissionFormalRevisionId();
        assertEquals(expectedFormal, jdbcTemplate.queryForObject(
                "SELECT formal_revision_id FROM published_revision WHERE article_id = ?",
                String.class, articleId), "发布版本必须推进到新批准的 formal revision");
        awaitIndexConsistency();
        assertEquals(1, liveDocCount(), "索引仍为单一活文档（新版本覆盖）");
        String liveSummary = jdbcTemplate.queryForObject(
                "SELECT summary FROM search_document WHERE object_type='ARTICLE' AND object_id = ? "
                        + "AND removed_at IS NULL", String.class, articleId);
        assertTrue(liveSummary != null && liveSummary.contains("修订"),
                "索引 summary 必须推进到批准的新版本，实际=" + liveSummary);
    }

    @Test
    void duplicateDecideIsRejectedOrIdempotent() throws Exception {
        String submissionId = submitArticle("一致性重复决策");
        approve(submissionId);
        String statusBefore = articleStatus();
        int revisionsBefore = publishedRevisionCount();

        // 第二次 decide：必须被拒绝（冲突/404）或幂等——绝不允许二次发布/改写
        var result = mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andReturn();
        int bodyCode = objectMapper.readTree(result.getResponse()
                .getContentAsString()).path("code").asInt(0);
        assertTrue(bodyCode == 409 || bodyCode == 404 || bodyCode == 400,
                "重复 decide 必须被拒绝，实际 body code " + bodyCode);

        assertEquals(statusBefore, articleStatus(), "重复 decide 不得改写 article 状态");
        assertEquals(revisionsBefore, publishedRevisionCount(), "重复 decide 不得产生新发布版本");
    }

    @Test
    void concurrentDecideOnSameSubmissionAllowsExactlyOneWinner() throws Exception {
        String submissionId = submitArticle("一致性并发决策");
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger success = new AtomicInteger(0);
        AtomicInteger rejected = new AtomicInteger(0);
        Runnable actor = () -> {
            try {
                ready.countDown();
                go.await();
                var result = mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                                .header("satoken", adminToken)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"decision\":\"APPROVED\"}"))
                        .andReturn();
                int httpStatus = result.getResponse().getStatus();
                int bodyCode = objectMapper.readTree(result.getResponse()
                        .getContentAsString()).path("code").asInt(httpStatus);
                if (httpStatus == 200 && bodyCode == 200) success.incrementAndGet();
                else rejected.incrementAndGet();
            } catch (Exception ignored) {
                rejected.incrementAndGet();
            }
        };
        Thread t1 = new Thread(actor, "decide-1");
        Thread t2 = new Thread(actor, "decide-2");
        t1.start();
        t2.start();
        ready.await();
        go.countDown();
        t1.join(30_000);
        t2.join(30_000);

        assertEquals(1, success.get(), "并发 decide 必须恰好一个成功");
        assertTrue(rejected.get() >= 1, "另一个必须被拒绝");
        assertEquals("PUBLISHED", articleStatus());
        assertEquals(1, publishedRevisionCount(), "并发不得产生重复发布版本");
    }
}
