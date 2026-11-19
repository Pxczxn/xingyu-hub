package top.pxczxn.xingyu;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 活动更新只写本次提交的列。清空结束时间后，只改标题不能把旧结束时间写回去。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventPartialUpdateIntegrationTest {

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
    @DisplayName("标题和状态两种顺序都保留")
    void titleAndStatusDoNotClobber() throws Exception {
        String token = adminToken();
        String first = insertEvent();
        patchEvent(token, first, "{\"title\":\"新标题\"}").andExpect(jsonPath("$.code").value(200));
        patchEvent(token, first, "{\"status\":\"ARCHIVED\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("新标题", column(first, "title"));
        assertEquals("ARCHIVED", column(first, "status"));
        assertEquals("旧正文", column(first, "body"));

        String second = insertEvent();
        patchEvent(token, second, "{\"status\":\"ARCHIVED\"}").andExpect(jsonPath("$.code").value(200));
        patchEvent(token, second, "{\"title\":\"后写标题\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("后写标题", column(second, "title"));
        assertEquals("ARCHIVED", column(second, "status"));
        assertEquals("旧正文", column(second, "body"));
    }

    @Test
    @DisplayName("标题和正文互不覆盖")
    void titleAndBodyDoNotClobber() throws Exception {
        String token = adminToken();
        String id = insertEvent();
        patchEvent(token, id, "{\"title\":\"只改标题\"}").andExpect(jsonPath("$.code").value(200));
        patchEvent(token, id, "{\"body\":\"只改正文\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("只改标题", column(id, "title"));
        assertEquals("只改正文", column(id, "body"));
        assertEquals("ACTIVE", column(id, "status"));
    }

    @Test
    @DisplayName("清空结束时间后只改标题，结束时间仍为空")
    void clearingEndsAtSurvivesTitleUpdate() throws Exception {
        String token = adminToken();
        String id = insertEvent();
        assertTrue(jdbcTemplate.queryForObject(
                "SELECT ends_at IS NOT NULL FROM community_event WHERE id = ?", Boolean.class, id));
        patchEvent(token, id, "{\"endsAt\":null}").andExpect(jsonPath("$.code").value(200));
        patchEvent(token, id, "{\"title\":\"清空之后\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("清空之后", column(id, "title"));
        assertNull(jdbcTemplate.queryForObject(
                "SELECT ends_at FROM community_event WHERE id = ?", Object.class, id));
        assertEquals("旧正文", column(id, "body"));
    }

    @Test
    @DisplayName("详情页只改状态，投稿终态仍不能改判")
    void statusOnlyAndReviewTerminalStayNarrow() throws Exception {
        String token = adminToken();
        String eventId = insertEvent();
        patchEvent(token, eventId, "{\"status\":\"ARCHIVED\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("ARCHIVED", column(eventId, "status"));
        assertEquals("旧标题", column(eventId, "title"));
        assertEquals("旧正文", column(eventId, "body"));

        String submissionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO event_submission
                    (id, event_id, author_id, object_type, object_id, note, status, created_at)
                VALUES (?, ?, ?, 'ARTICLE', ?, 'keep-note', 'SUBMITTED', UTC_TIMESTAMP())
                """, submissionId, eventId, UUID.randomUUID().toString(), UUID.randomUUID().toString());
        review(token, submissionId, "ACCEPTED").andExpect(jsonPath("$.code").value(200));
        review(token, submissionId, "REJECTED")
                .andExpect(jsonPath("$.code").value(409))
                .andExpect(jsonPath("$.message").value("投稿已审核，不能再次改判"));
        assertEquals("ACCEPTED", jdbcTemplate.queryForObject(
                "SELECT status FROM event_submission WHERE id = ?", String.class, submissionId));
    }

    private org.springframework.test.web.servlet.ResultActions patchEvent(String token, String id, String json) throws Exception {
        return mockMvc.perform(patch("/api/v1/admin/community/events/" + id)
                .header("satoken", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions review(String token, String submissionId, String decision)
            throws Exception {
        return mockMvc.perform(post("/api/v1/admin/community/events/submissions/" + submissionId + "/review")
                .header("satoken", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"" + decision + "\"}"))
                .andExpect(status().isOk());
    }

    private String insertEvent() {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_event
                    (id, slug, title, body, status, starts_at, ends_at, submission_open, created_at, updated_at)
                VALUES (?, ?, '旧标题', '旧正文', 'ACTIVE', UTC_TIMESTAMP(),
                        DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 DAY), 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
                """, id, "e37-" + id.substring(0, 8));
        return id;
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

    private String column(String id, String name) {
        return jdbcTemplate.queryForObject(
                "SELECT " + name + " FROM community_event WHERE id = ?", String.class, id);
    }
}
