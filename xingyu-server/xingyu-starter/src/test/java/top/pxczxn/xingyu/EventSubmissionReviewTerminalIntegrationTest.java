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
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 活动投稿只有 SUBMITTED 可以审核。终态和未知状态拒绝改判，并发审核只有一笔成功。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventSubmissionReviewTerminalIntegrationTest {

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

    @BeforeEach
    void requireIsolatedTargets() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        assertEquals("xingyu_hub_test", jdbcTemplate.queryForObject("SELECT DATABASE()", String.class));
        try (Connection connection = dataSource.getConnection()) {
            assertEquals("xingyu_hub_test", connection.getCatalog());
            String url = connection.getMetaData().getURL();
            assertTrue(url.contains("/xingyu_hub_test"), url);
            assertFalse(url.contains("/xingyu_hub?"), url);
        }
        assertTrue(redisConnectionFactory instanceof LettuceConnectionFactory);
        assertEquals(7, ((LettuceConnectionFactory) redisConnectionFactory).getDatabase());
    }

    @Test
    @DisplayName("待审核可以通过，并出现在公开投稿墙")
    void submittedCanBeAccepted() throws Exception {
        String eventId = insertEvent();
        String submissionId = insertSubmission(eventId, "SUBMITTED");
        review(adminToken(), submissionId, "ACCEPTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("ACCEPTED"));
        assertEquals("ACCEPTED", submissionStatus(submissionId));
        assertEquals("keep-note", submissionNote(submissionId));
        String wall = mockMvc.perform(get("/api/v1/events/" + eventId + "/submissions"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(wall.contains(submissionId), wall);
    }

    @Test
    @DisplayName("待审核可以拒绝，公开投稿墙不展示")
    void submittedCanBeRejected() throws Exception {
        String eventId = insertEvent();
        String submissionId = insertSubmission(eventId, "SUBMITTED");
        review(adminToken(), submissionId, "REJECTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("REJECTED"));
        assertEquals("REJECTED", submissionStatus(submissionId));
        String body = mockMvc.perform(get("/api/v1/events/" + eventId + "/submissions"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains(submissionId));
    }

    @Test
    @DisplayName("已通过不能再拒绝")
    void acceptedCannotBeRejectedAgain() throws Exception {
        String submissionId = insertSubmission(insertEvent(), "ACCEPTED");
        review(adminToken(), submissionId, "REJECTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("投稿已审核，不能再次改判"));
        assertEquals("ACCEPTED", submissionStatus(submissionId));
        assertEquals("keep-note", submissionNote(submissionId));
    }

    @Test
    @DisplayName("已拒绝不能再通过")
    void rejectedCannotBeAcceptedAgain() throws Exception {
        String submissionId = insertSubmission(insertEvent(), "REJECTED");
        review(adminToken(), submissionId, "ACCEPTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("投稿已审核，不能再次改判"));
        assertEquals("REJECTED", submissionStatus(submissionId));
    }

    @Test
    @DisplayName("未知状态不能审核")
    void unknownStatusCannotBeReviewed() throws Exception {
        String submissionId = insertSubmission(insertEvent(), "HOLD");
        review(adminToken(), submissionId, "ACCEPTED")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("当前状态不能审核"));
        assertEquals("HOLD", submissionStatus(submissionId));
    }

    @Test
    @DisplayName("非法审核值不改投稿")
    void invalidDecisionLeavesSubmissionUntouched() throws Exception {
        String submissionId = insertSubmission(insertEvent(), "SUBMITTED");
        review(adminToken(), submissionId, "MAYBE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
        assertEquals("SUBMITTED", submissionStatus(submissionId));
        assertEquals("keep-note", submissionNote(submissionId));
    }

    @Test
    @DisplayName("并发审核同一投稿只有一笔成功")
    void concurrentReviewsAllowOnlyOneWinner() throws Exception {
        String tokenA = adminToken();
        String tokenB = adminToken();
        String submissionId = insertSubmission(insertEvent(), "SUBMITTED");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            Future<MvcResult> first = pool.submit(() -> reviewAfter(tokenA, submissionId, "ACCEPTED", ready, go));
            Future<MvcResult> second = pool.submit(() -> reviewAfter(tokenB, submissionId, "REJECTED", ready, go));
            assertTrue(ready.await(15, TimeUnit.SECONDS));
            go.countDown();
            int codeA = envelopeCode(first.get(20, TimeUnit.SECONDS));
            int codeB = envelopeCode(second.get(20, TimeUnit.SECONDS));
            assertEquals(1, (codeA == 200 ? 1 : 0) + (codeB == 200 ? 1 : 0));
            assertEquals(1, (codeA == 409 ? 1 : 0) + (codeB == 409 ? 1 : 0));
            String status = submissionStatus(submissionId);
            assertTrue("ACCEPTED".equals(status) || "REJECTED".equals(status), status);
            assertEquals("keep-note", submissionNote(submissionId));
        } finally {
            pool.shutdownNow();
        }
    }

    private org.springframework.test.web.servlet.ResultActions review(String token, String submissionId, String decision)
            throws Exception {
        return mockMvc.perform(post("/api/v1/admin/community/events/submissions/" + submissionId + "/review")
                .header("satoken", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + decision + "\"}"));
    }

    private MvcResult reviewAfter(
            String token, String submissionId, String decision, CountDownLatch ready, CountDownLatch go)
            throws Exception {
        ready.countDown();
        assertTrue(go.await(15, TimeUnit.SECONDS));
        return review(token, submissionId, decision).andReturn();
    }

    private int envelopeCode(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("code").asInt();
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

    private String insertEvent() {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_event
                    (id, slug, title, body, status, submission_open, created_at, updated_at)
                VALUES (?, ?, 'phase36', 'body', 'ACTIVE', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, id, "p36-" + id.substring(0, 8));
        return id;
    }

    private String insertSubmission(String eventId, String status) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO event_submission
                    (id, event_id, author_id, object_type, object_id, note, status, created_at)
                VALUES (?, ?, ?, 'ARTICLE', ?, 'keep-note', ?, UTC_TIMESTAMP())
                """, id, eventId, UUID.randomUUID().toString(), UUID.randomUUID().toString(), status);
        return id;
    }

    private String submissionStatus(String submissionId) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM event_submission WHERE id = ?", String.class, submissionId);
    }

    private String submissionNote(String submissionId) {
        return jdbcTemplate.queryForObject(
                "SELECT note FROM event_submission WHERE id = ?", String.class, submissionId);
    }
}
