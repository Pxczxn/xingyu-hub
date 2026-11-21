package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.service.ModerationMeasureExecutor;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 治理隐藏和恢复与作者写入交错。作者事务使用 REPEATABLE READ，先改自己的字段并持有行锁；
 * 治理线程必须停在这把锁上，然后作者提交，治理再只写自己的状态列。
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "xingyu.event.consumer.delay-ms=3600000")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GovernanceNarrowUpdateIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private DataSource dataSource;
    @Autowired
    private RedisConnectionFactory redisConnectionFactory;
    @Autowired
    private SysConfigGroupService configGroupService;
    @Autowired
    private ModerationMeasureExecutor measureExecutor;
    @Autowired
    private ModerationMeasureMapper measureMapper;

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.requireIsolatedTargets(
                configGroupService, jdbcTemplate, dataSource, redisConnectionFactory);
    }

    @Test
    @DisplayName("作者改标题和分类时，治理隐藏只改治理状态")
    void hideDoesNotOverwriteAuthorTitleOrCategory() throws Exception {
        String author = registerAndLogin("p24hide");
        String articleId = publishArticle(author, "并发标题");
        String categoryId = insertCategory(articleId, "p24hide");
        String title = "作者新标题" + System.nanoTime();
        ModerationMeasure measure = measure("ARTICLE", articleId);

        overlap(connection -> {
            update(connection, "UPDATE working_draft SET title = ? WHERE article_id = ?", title, articleId);
            update(connection, "UPDATE article SET category_id = ? WHERE id = ?", categoryId, articleId);
        }, () -> measureExecutor.apply(measure));

        assertEquals("HIDDEN", moderation(articleId));
        assertEquals(title, draftTitle(articleId));
        assertEquals(categoryId, category(articleId));
        assertEquals("PUBLISHED", editorial(articleId));
        assertEquals("ACTIVE", lifecycle(articleId));
        assertNotNull(publishedPointer(articleId));
    }

    @Test
    @DisplayName("作者改正文和分类时，申诉恢复只改治理状态")
    void restoreDoesNotOverwriteAuthorBodyOrCategory() throws Exception {
        String author = registerAndLogin("p24back");
        String articleId = publishArticle(author, "恢复并发");
        String pointer = publishedPointer(articleId);
        measureExecutor.apply(measure("ARTICLE", articleId));
        assertEquals("HIDDEN", moderation(articleId));
        String categoryId = insertCategory(articleId, "p24back");
        String body = "作者新正文" + System.nanoTime();
        ModerationMeasure measure = latestMeasure(articleId);

        overlap(connection -> {
            update(connection, "UPDATE working_draft SET body = ? WHERE article_id = ?", body, articleId);
            update(connection, "UPDATE article SET category_id = ? WHERE id = ?", categoryId, articleId);
        }, () -> measureExecutor.revoke(measure));

        assertEquals("NORMAL", moderation(articleId));
        assertEquals(body, draftBody(articleId));
        assertEquals(categoryId, category(articleId));
        assertEquals("PUBLISHED", editorial(articleId));
        assertEquals("ACTIVE", lifecycle(articleId));
        assertEquals(pointer, publishedPointer(articleId));
    }

    @Test
    @DisplayName("作者写入新动态正文时，治理隐藏不覆盖正文")
    void hideDoesNotOverwriteMomentBody() throws Exception {
        String author = registerAndLogin("p24mom");
        String momentId = createMoment(author, "原正文");
        String authorId = jdbcTemplate.queryForObject(
                "SELECT author_id FROM moment WHERE id = ?", String.class, momentId);
        String body = "并发正文" + System.nanoTime();
        ModerationMeasure measure = measure("MOMENT", momentId);

        overlap(connection -> {
            update(connection,
                    """
                    INSERT INTO moment_revision (id, moment_id, body, revision_number, created_at)
                    VALUES (?, ?, ?, 2, UTC_TIMESTAMP())
                    """,
                    UUID.randomUUID().toString(), momentId, body);
            update(connection, "UPDATE moment SET updated_at = UTC_TIMESTAMP() WHERE id = ?", momentId);
        }, () -> measureExecutor.apply(measure));

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals("PUBLISHED", prior(measure.getId()));
        assertEquals(body, latestMomentBody(momentId));
        assertEquals(authorId, jdbcTemplate.queryForObject(
                "SELECT author_id FROM moment WHERE id = ?", String.class, momentId));
    }

    @Test
    @DisplayName("作者已把评论改成删除后，治理不能再写成隐藏")
    void hideDoesNotReviveDeletedComment() throws Exception {
        String author = registerAndLogin("p24cmt");
        String momentId = createMoment(author, "评论宿主");
        String commentId = createComment(author, momentId, "原评论");
        String body = "删除前正文" + System.nanoTime();
        ModerationMeasure measure = measure("COMMENT", commentId);

        overlap(connection -> update(connection,
                "UPDATE comment SET status = 'DELETED', body = ? WHERE id = ?", body, commentId),
                () -> measureExecutor.apply(measure));

        assertEquals("DELETED", commentStatus(commentId));
        assertEquals(body, jdbcTemplate.queryForObject(
                "SELECT body FROM comment WHERE id = ?", String.class, commentId));
        assertEquals("DELETED", prior(measure.getId()));
    }

    @Test
    @DisplayName("驳回申诉保持隐藏，重复裁决按终态拒绝")
    void rejectedAppealStaysHiddenAndCannotBeDecidedAgain() throws Exception {
        String author = registerAndLogin("p24rejA");
        String reporter = registerAndLogin("p24rejR");
        String momentId = createMoment(author, "驳回仍隐藏");
        String caseId = uphold(reporter, "MOMENT", momentId);
        String appealId = submitAppeal(author, caseId);

        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REJECTED\"}"))
                .andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(post("/api/v1/admin/moderation/appeals/" + appealId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\"}"))
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("申诉已处理"));

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals("REJECTED", jdbcTemplate.queryForObject(
                "SELECT status FROM appeal WHERE id = ?", String.class, appealId));
        assertEquals("PUBLISHED", priorOfCase(caseId));
    }

    @Test
    @DisplayName("历史措施没有 prior_status 时，撤销不改动态状态")
    void nullPriorStatusDoesNotRestoreMoment() throws Exception {
        String author = registerAndLogin("p24null");
        String momentId = createMoment(author, "历史隐藏");
        jdbcTemplate.update("UPDATE moment SET status = 'HIDDEN' WHERE id = ?", momentId);
        ModerationMeasure measure = measure("MOMENT", momentId);

        measureExecutor.revoke(measure);

        assertEquals("HIDDEN", momentStatus(momentId));
        assertEquals(null, prior(measure.getId()));
    }

    private void overlap(SqlWork author, Runnable governance) throws Exception {
        ExecutorService pool = Executors.newSingleThreadExecutor();
        Future<?> waiting = null;
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
            author.run(connection);
            waiting = pool.submit(governance);
            long started = System.nanoTime();
            boolean blocked = false;
            while (!waiting.isDone() && System.nanoTime() - started < TimeUnit.SECONDS.toNanos(15)) {
                if (System.nanoTime() - started > TimeUnit.MILLISECONDS.toNanos(400)) {
                    blocked = true;
                    break;
                }
                Thread.sleep(40);
            }
            connection.commit();
            assertTrue(blocked, "治理写入没有停在作者未提交的行锁上");
            waiting.get(20, TimeUnit.SECONDS);
            waiting = null;
        } finally {
            if (waiting != null) {
                waiting.cancel(true);
            }
            pool.shutdownNow();
        }
    }

    private ModerationMeasure measure(String type, String targetId) {
        ModerationMeasure measure = new ModerationMeasure();
        measure.setId(UUID.randomUUID().toString());
        measure.setDecisionId(UUID.randomUUID().toString());
        measure.setMeasureType(ModerationMeasureExecutor.MEASURE_HIDE);
        measure.setTargetType(type);
        measure.setTargetId(targetId);
        measure.setCreatedAt(Instant.now());
        measureMapper.insert(measure);
        return measure;
    }

    private ModerationMeasure latestMeasure(String targetId) {
        String id = jdbcTemplate.queryForObject(
                """
                SELECT id FROM moderation_measure
                WHERE target_id = ? AND measure_type = 'HIDE_CONTENT'
                ORDER BY created_at DESC LIMIT 1
                """,
                String.class, targetId);
        return measureMapper.selectById(id);
    }

    private String insertCategory(String articleId, String prefix) {
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT space_id FROM article WHERE id = ?", String.class, articleId);
        String categoryId = UUID.randomUUID().toString();
        String slug = prefix + System.nanoTime();
        jdbcTemplate.update(
                """
                INSERT INTO creation_space_category
                    (id, space_id, name, slug, status, lock_version, sort_order, created_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', 0, 0, ?)
                """,
                categoryId, spaceId, slug, slug, Timestamp.from(Instant.now()));
        return categoryId;
    }

    private static void update(Connection connection, String sql, String... values) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) {
                statement.setString(i + 1, values[i]);
            }
            statement.executeUpdate();
        }
    }

    private String publishArticle(String token, String title) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .path("articleId").asText();
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(title)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", token))
                .andExpect(status().isOk());
        MvcResult queue = mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", adminToken()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rows = objectMapper.readTree(queue.getResponse().getContentAsString());
        JsonNode list = rows.isArray() ? rows : rows.path("data");
        String submissionId = null;
        for (JsonNode row : list) {
            if (articleId.equals(row.path("articleId").asText(null))) {
                submissionId = row.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId);
        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());
        return articleId;
    }

    private String uphold(String reporter, String type, String objectId) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", reporter)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"%s","objectId":"%s","reason":"SPAM"}
                                """.formatted(type, objectId)))
                .andExpect(status().isOk())
                .andReturn();
        String reportId = objectMapper.readTree(result.getResponse().getContentAsString()).path("reportId").asText();
        String caseId = jdbcTemplate.queryForObject(
                "SELECT id FROM moderation_case WHERE report_id = ?", String.class, reportId);
        mockMvc.perform(post("/api/v1/admin/moderation/cases/" + caseId + "/decide")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"UPHELD\"}"))
                .andExpect(jsonPath("$.code").value(200));
        return caseId;
    }

    private String submitAppeal(String author, String caseId) throws Exception {
        String measureId = jdbcTemplate.queryForObject(
                """
                SELECT m.id FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                String.class, caseId);
        MvcResult result = mockMvc.perform(post("/api/v1/appeals")
                        .header("satoken", author)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"caseId":"%s","measureId":"%s","detail":"请求恢复"}
                                """.formatted(caseId, measureId)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
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

    private String createComment(String token, String momentId, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","body":"%s"}
                                """.formatted(momentId, body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
    }

    private String registerAndLogin(String prefix) throws Exception {
        long nonce = System.nanoTime() % 100_000_000L;
        String username = prefix + nonce;
        String email = username + "@example.com";
        String password = "Test1234!@#ab";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String moderation(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT moderation_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String editorial(String articleId) {
        return jdbcTemplate.queryForObject("SELECT status FROM article WHERE id = ?", String.class, articleId);
    }

    private String lifecycle(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT lifecycle_status FROM article WHERE id = ?", String.class, articleId);
    }

    private String category(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT category_id FROM article WHERE id = ?", String.class, articleId);
    }

    private String publishedPointer(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT formal_revision_id FROM published_revision WHERE article_id = ?",
                String.class, articleId);
    }

    private String draftTitle(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT title FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String draftBody(String articleId) {
        return jdbcTemplate.queryForObject(
                "SELECT body FROM working_draft WHERE article_id = ?", String.class, articleId);
    }

    private String momentStatus(String momentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM moment WHERE id = ?", String.class, momentId);
    }

    private String commentStatus(String commentId) {
        return jdbcTemplate.queryForObject("SELECT status FROM comment WHERE id = ?", String.class, commentId);
    }

    private String latestMomentBody(String momentId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT body FROM moment_revision
                WHERE moment_id = ? ORDER BY revision_number DESC LIMIT 1
                """,
                String.class, momentId);
    }

    private String prior(String measureId) {
        return jdbcTemplate.query(
                "SELECT prior_status FROM moderation_measure WHERE id = ?",
                rs -> rs.next() ? rs.getString(1) : null, measureId);
    }

    private String priorOfCase(String caseId) {
        return jdbcTemplate.query(
                """
                SELECT m.prior_status FROM moderation_measure m
                INNER JOIN moderation_decision d ON d.id = m.decision_id
                WHERE d.case_id = ?
                """,
                rs -> rs.next() ? rs.getString(1) : null, caseId);
    }

    @FunctionalInterface
    private interface SqlWork {
        void run(Connection connection) throws SQLException;
    }
}
