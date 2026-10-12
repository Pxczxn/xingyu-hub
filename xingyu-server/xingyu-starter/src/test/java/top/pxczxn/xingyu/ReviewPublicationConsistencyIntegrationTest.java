package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
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

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 审核批准与发布一致性验证（Phase 7-F.1 重构版，2026-10-11）。
 *
 * <p>相对首版（f32ebe1）的测试缺陷修正：
 * <ol>
 *   <li>每个测试通过 createAndSeedArticle 创建<b>独立</b>文章并在 AfterEach
 *       精确清理——不再共享可变 articleId；</li>
 *   <li>首次发布与二次修订针对<b>同一 articleId</b>（真正验证版本推进）；</li>
 *   <li>草稿显式 visibility=PUBLIC（createShell 默认 PRIVATE，私有文章不应
 *       进入公开索引——此前依赖缺省值却期待 live=1 是测试错误）；</li>
 *   <li>草稿字段用 summary（saveDraft 契约），非 description；</li>
 *   <li>管理端断言读取 envelope 的 body code（管理端错误 = HTTP 200 + code），
 *       approve 的缺省值 asInt(0)（缺失 code 视为失败而非成功）；</li>
 *   <li>重复/并发 decide 精确断言业务 CONFLICT（envelope code 409），
 *       任意异常不算预期拒绝。</li>
 * </ol>
 *
 * <p>锁定不变量：批准后 article=PUBLISHED、published_revision 推进到本次批准的
 * formal_revision_id、published_revision 按 article 单行（不累加行）、公开索引
 * 异步最终一致（轮询等待）且内容为批准版本。
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

    private String authorToken;
    private String authorId;
    private String adminToken;

    /** 本轮 fixture 登记表——AfterEach 精确清理。 */
    private final List<String> articleIds = new ArrayList<>();

    @Autowired
    private top.pxczxn.xingyu.system.service.SysConfigGroupService configGroupService;

    @BeforeAll
    void seedAuthorAndAdmin() throws Exception {
        top.pxczxn.xingyu.CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        authorId = UUID.randomUUID().toString();
        String slugSuffix = String.valueOf(System.nanoTime() % 100000000L);
        String email = "rpcons-" + System.nanoTime() + "@example.com";
        jdbcTemplate.update("""
                INSERT INTO community_user (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, authorId, email, top.pxczxn.xingyu.community.support.PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, '一致性验收', NOW())
                """, UUID.randomUUID().toString(), authorId, "rpcons-space-" + slugSuffix);
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, username, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), authorId);
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
    void cleanupAuthor() {
        jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", authorId);
        jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", authorId);
        jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", authorId);
        jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", authorId);
    }

    @AfterEach
    void cleanupFixture() {
        for (String articleId : articleIds) {
            jdbcTemplate.update("DELETE FROM search_document WHERE object_type='ARTICLE' AND object_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM review_decision WHERE submission_id IN (SELECT id FROM review_submission WHERE article_id = ?)", articleId);
            jdbcTemplate.update("DELETE FROM review_submission WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM working_draft WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        }
        articleIds.clear();
    }

    /**
     * 创建壳 → 显式 PUBLIC 保存草稿（summary 契约）→ 投稿。
     * 返回 articleId；fixture 登记在 articleIds 供 AfterEach 清理。
     */
    private String createAndSeedArticle(String title) throws Exception {
        MvcResult shell = mockMvc.perform(post("/api/v1/me/articles").header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(shell.getResponse().getContentAsString())
                .path("articleId").asText();
        articleIds.add(articleId);

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"summary\":\"一致性验收摘要\","
                                + "\"body\":\"# 正文\\n\\n一致性验收内容。\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String submit(String articleId) throws Exception {
        MvcResult submit = mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(submit.getResponse().getContentAsString())
                .path("submissionId").asText(null);
    }

    /** decide 并断言 envelope code==200（缺省 0 = 缺失 code 视为失败）。 */
    private int approve(String submissionId) throws Exception {
        var result = mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse()
                .getContentAsString()).path("code").asInt(0);
    }

    private String articleStatus(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?",
                String.class, articleId);
    }

    private String publishedFormalRevisionId(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT formal_revision_id FROM published_revision WHERE article_id = ?",
                String.class, articleId);
    }

    private String submissionFormalRevisionId(String submissionId) {
        return jdbcTemplate.queryForObject(
                "SELECT formal_revision_id FROM review_submission WHERE id = ?",
                String.class, submissionId);
    }

    private int liveDocCount(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type='ARTICLE' AND object_id = ? "
                        + "AND removed_at IS NULL", Integer.class, articleId);
    }

    private String liveDocSummary(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT summary FROM search_document WHERE object_type='ARTICLE' AND object_id = ? "
                        + "AND removed_at IS NULL", String.class, articleId);
    }

    /** PUBLICATION_SUCCEEDED 为异步可靠事件——轮询等待索引行出现。 */
    private void awaitIndexLive(String articleId) throws Exception {
        for (int i = 0; i < 15; i++) {
            if (liveDocCount(articleId) > 0) return;
            Thread.sleep(1000);
        }
    }

    /** 等待索引 summary 推进到指定内容（修订 reindex 异步完成）。 */
    private void awaitIndexSummary(String articleId, String keyword) throws Exception {
        for (int i = 0; i < 15; i++) {
            String summary = liveDocSummary(articleId);
            if (summary != null && summary.contains(keyword)) return;
            Thread.sleep(1000);
        }
    }

    // ---- 场景 1+2：同 articleId 的首投与修订版本推进 ----

    @Test
    void firstSubmissionThenResubmitAdvancesPublishedVersionOnSameArticle() throws Exception {
        String articleId = createAndSeedArticle("一致性首投");

        String submission1 = submit(articleId);
        assertEquals(200, approve(submission1), "首投批准必须成功");

        assertEquals("PUBLISHED", articleStatus(articleId));
        String formal1 = submissionFormalRevisionId(submission1);
        assertEquals(formal1, publishedFormalRevisionId(articleId),
                "published_revision 必须对齐首投的 formal revision");
        awaitIndexLive(articleId);
        assertTrue(liveDocSummary(articleId).contains("一致性验收摘要"),
                "索引 summary 必须是首投版本");

        // 同一 articleId：编辑 → 二次投稿 → 批准
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"一致性修订版\",\"summary\":\"修订后的摘要\","
                                + "\"body\":\"# 修订正文\",\"visibility\":\"PUBLIC\"}"))
                .andExpect(status().isOk());
        String submission2 = submit(articleId);
        assertNotEquals(submission1, submission2, "两次投稿必须是不同 submission");
        assertNotEquals(submissionFormalRevisionId(submission1),
                submissionFormalRevisionId(submission2), "两次投稿必须有不同 formal revision");
        assertEquals(200, approve(submission2), "修订批准必须成功");

        // 版本推进：published_revision 仍单行、对齐第二次 formal revision
        assertEquals("PUBLISHED", articleStatus(articleId));
        assertEquals(submissionFormalRevisionId(submission2), publishedFormalRevisionId(articleId),
                "published_revision 必须推进到第二次批准的 formal revision");
        awaitIndexSummary(articleId, "修订后的摘要");
        assertTrue(liveDocSummary(articleId).contains("修订后的摘要"),
                "公开索引必须更新为第二版内容");
        assertEquals(1, liveDocCount(articleId), "索引仍为单一活文档");
    }

    // ---- 场景 3：重复 decide 精确 CONFLICT ----

    @Test
    void duplicateDecideReturnsBusinessConflict() throws Exception {
        String articleId = createAndSeedArticle("重复决策探针");
        String submissionId = submit(articleId);
        assertEquals(200, approve(submissionId), "首次批准必须成功");
        String statusBefore = articleStatus(articleId);
        String formalBefore = publishedFormalRevisionId(articleId);

        var result = mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(status().isOk())
                .andReturn();
        int bodyCode = objectMapper.readTree(result.getResponse()
                .getContentAsString()).path("code").asInt(0);
        assertEquals(409, bodyCode, "重复 decide 必须返回业务 CONFLICT，实际=" + bodyCode
                + " body=" + result.getResponse().getContentAsString(
                        java.nio.charset.StandardCharsets.UTF_8));

        assertEquals(statusBefore, articleStatus(articleId), "重复 decide 不得改写状态");
        assertEquals(formalBefore, publishedFormalRevisionId(articleId), "不得产生新发布版本");
    }

    // ---- 场景 4：并发 decide 恰好一个成功（业务 CONFLICT 精确判定）----

    @Test
    void concurrentDecideAllowsExactlyOneBusinessSuccess() throws Exception {
        String articleId = createAndSeedArticle("并发决策探针");
        String submissionId = submit(articleId);

        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger businessSuccess = new AtomicInteger(0);
        AtomicInteger businessConflict = new AtomicInteger(0);
        AtomicInteger unexpected = new AtomicInteger(0);
        AtomicReference<String> unexpectedDetail = new AtomicReference<>("");

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
                var body = objectMapper.readTree(result.getResponse().getContentAsString());
                int bodyCode = body.path("code").asInt(httpStatus);
                if (httpStatus == 200 && bodyCode == 200) {
                    businessSuccess.incrementAndGet();
                } else if (httpStatus == 200 && bodyCode == 409) {
                    businessConflict.incrementAndGet();
                } else {
                    unexpected.incrementAndGet();
                    unexpectedDetail.set("http=" + httpStatus + " code=" + bodyCode);
                }
            } catch (Exception ex) {
                // 测试自身/框架异常——不算业务 CONFLICT
                unexpected.incrementAndGet();
                unexpectedDetail.set("exception: " + ex.getMessage());
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

        assertEquals(1, businessSuccess.get(), "并发 decide 必须恰好一个业务成功");
        assertEquals(1, businessConflict.get(), "另一个必须是业务 CONFLICT（envelope 409）");
        assertEquals(0, unexpected.get(), "不得出现非预期异常，" + unexpectedDetail.get());
        assertEquals("PUBLISHED", articleStatus(articleId));
        assertEquals(1, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM published_revision WHERE article_id = ?",
                Integer.class, articleId), "并发不得产生重复发布版本");
    }

    // ---- 场景 5：PRIVATE 文章不进公开索引（createShell 缺省语义）----

    @Test
    void privateDraftMustNotEnterPublicIndexEvenAfterApproval() throws Exception {
        MvcResult shell = mockMvc.perform(post("/api/v1/me/articles").header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(shell.getResponse().getContentAsString())
                .path("articleId").asText();
        articleIds.add(articleId);
        // 保存草稿但故意不传 visibility（保持 createShell 的 PRIVATE 缺省）
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", authorToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"私有探针\",\"summary\":\"私有摘要\","
                                + "\"body\":\"# 私有正文\"}"))
                .andExpect(status().isOk());
        String submissionId = submit(articleId);
        approve(submissionId);

        assertEquals("PUBLISHED", articleStatus(articleId),
                "发布流程正常（可见性不影响发布状态机）");
        awaitIndexLive(articleId);
        assertEquals(0, liveDocCount(articleId),
                "PRIVATE 文章批准后也不得进入公开索引（isDiscoverable 规则）");
    }
}
