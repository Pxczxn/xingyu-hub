package top.pxczxn.xingyu;

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
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.sql.DataSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 指南创建和更新只接受 PUBLISHED、DRAFT、ARCHIVED。公开读仍只返回 PUBLISHED。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GuideStatusWhitelistIntegrationTest {

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
        CommunityTestSupport.requireIsolatedTargets(
                configGroupService, jdbcTemplate, dataSource, redisConnectionFactory);
    }

    @Test
    @DisplayName("三种合法状态可以保存，只有已发布对公开可读")
    void legalStatusesKeepPublicRead() throws Exception {
        String token = adminToken();
        String published = create(token, null, "PUBLISHED");
        String draft = create(token, "draft", "DRAFT");
        String archived = create(token, "ARCHIVED", "ARCHIVED");

        assertPublished(slugOf(published), true);
        assertPublished(slugOf(draft), false);
        assertPublished(slugOf(archived), false);
    }

    @Test
    @DisplayName("省略状态时创建为已发布")
    void omittedStatusDefaultsToPublished() throws Exception {
        String slug = "g36-" + System.nanoTime();
        mockMvc.perform(post("/api/v1/admin/community/guide-pages")
                        .header("satoken", adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","title":"缺省","body":"正文","sortOrder":"-1000000"}
                                """.formatted(slug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
        assertEquals("PUBLISHED", statusOf(slug));
        assertPublished(slug, true);
    }

    @Test
    @DisplayName("空状态和未知状态不写入")
    void blankAndUnknownStatusesAreRejected() throws Exception {
        String token = adminToken();
        String blankSlug = "g36-blank-" + System.nanoTime();
        mockMvc.perform(post("/api/v1/admin/community/guide-pages")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","title":"空","body":"正文","status":"  "}
                                """.formatted(blankSlug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("status: 指南状态无效"));
        assertEquals(0, countBySlug(blankSlug));

        String nullSlug = "g36-null-" + System.nanoTime();
        mockMvc.perform(post("/api/v1/admin/community/guide-pages")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","title":"空","body":"正文","status":null}
                                """.formatted(nullSlug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
        assertEquals(0, countBySlug(nullSlug));

        String pageId = create(token, "PUBLISHED", "PUBLISHED");
        String slug = slugOf(pageId);
        mockMvc.perform(patch("/api/v1/admin/community/guide-pages/" + pageId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HIDDEN\",\"title\":\"不该写入\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("status: 指南状态无效"));
        assertEquals("PUBLISHED", statusOf(slug));
        assertEquals("原标题", titleOf(slug));
        assertPublished(slug, true);
    }

    private String create(String token, String requestedStatus, String expectedStatus) throws Exception {
        String slug = "g36-" + System.nanoTime();
        String statusField = requestedStatus == null ? "" : ",\"status\":\"" + requestedStatus + "\"";
        MvcResult result = mockMvc.perform(post("/api/v1/admin/community/guide-pages")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","title":"原标题","body":"正文","sortOrder":"-1000000"%s}
                                """.formatted(slug, statusField)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andExpect(jsonPath("$.data.status").value(expectedStatus))
                .andReturn();
        assertEquals(expectedStatus, statusOf(slug));
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asText();
    }

    private void assertPublished(String slug, boolean visible) throws Exception {
        int detail = mockMvc.perform(get("/api/v1/guide/" + slug)).andReturn().getResponse().getStatus();
        String list = mockMvc.perform(get("/api/v1/guide").param("limit", "200"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        if (visible) {
            assertEquals(200, detail);
            assertTrue(list.contains(slug));
        } else {
            assertEquals(404, detail);
            assertFalse(list.contains(slug));
        }
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

    private String statusOf(String slug) {
        return jdbcTemplate.queryForObject(
                "SELECT status FROM guide_page WHERE slug = ?", String.class, slug);
    }

    private String titleOf(String slug) {
        return jdbcTemplate.queryForObject(
                "SELECT title FROM guide_page WHERE slug = ?", String.class, slug);
    }

    private int countBySlug(String slug) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM guide_page WHERE slug = ?", Integer.class, slug);
        return count == null ? 0 : count;
    }

    private String slugOf(String pageId) {
        return jdbcTemplate.queryForObject(
                "SELECT slug FROM guide_page WHERE id = ?", String.class, pageId);
    }
}
