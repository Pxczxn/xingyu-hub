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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 指南更新只写本次提交的列。后保存的状态不能把先保存的标题写回去。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GuidePartialUpdateIntegrationTest {

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
    @DisplayName("先后改标题和状态，两边都留下")
    void titleThenStatusKeepsBoth() throws Exception {
        String token = adminToken();
        String id = create(token);
        patchPage(token, id, "{\"title\":\"新标题\"}").andExpect(jsonPath("$.code").value(200));
        patchPage(token, id, "{\"status\":\"DRAFT\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("新标题", column(id, "title"));
        assertEquals("DRAFT", column(id, "status"));
        assertEquals("原正文", column(id, "body"));
        assertEquals(3, Integer.parseInt(column(id, "sort_order")));
    }

    @Test
    @DisplayName("先改状态再改标题，标题不会把状态写回去")
    void statusThenTitleKeepsBoth() throws Exception {
        String token = adminToken();
        String id = create(token);
        patchPage(token, id, "{\"status\":\"ARCHIVED\"}").andExpect(jsonPath("$.code").value(200));
        patchPage(token, id, "{\"title\":\"后写标题\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("后写标题", column(id, "title"));
        assertEquals("ARCHIVED", column(id, "status"));
        assertEquals("原正文", column(id, "body"));
    }

    @Test
    @DisplayName("非法状态不改原记录，别名即使提交也不更新")
    void illegalStatusAndSlugDoNotClobber() throws Exception {
        String token = adminToken();
        String id = create(token);
        String slug = column(id, "slug");
        patchPage(token, id, "{\"title\":\"先改\"}").andExpect(jsonPath("$.code").value(200));
        patchPage(token, id, "{\"status\":\"HIDDEN\",\"title\":\"不该写入\"}")
                .andExpect(jsonPath("$.code").value(400));
        patchPage(token, id, "{\"slug\":\"hijacked-slug\"}").andExpect(jsonPath("$.code").value(200));
        assertEquals("先改", column(id, "title"));
        assertEquals("PUBLISHED", column(id, "status"));
        assertEquals(slug, column(id, "slug"));
        assertEquals("原正文", column(id, "body"));
    }

    private org.springframework.test.web.servlet.ResultActions patchPage(String token, String id, String json) throws Exception {
        return mockMvc.perform(patch("/api/v1/admin/community/guide-pages/" + id)
                .header("satoken", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isOk());
    }

    private String create(String token) throws Exception {
        String slug = "g37-" + System.nanoTime();
        MvcResult result = mockMvc.perform(post("/api/v1/admin/community/guide-pages")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"slug":"%s","title":"原标题","body":"原正文","status":"PUBLISHED","sortOrder":"3"}
                                """.formatted(slug)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200))
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).path("data").path("id").asText();
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
        return String.valueOf(jdbcTemplate.queryForObject(
                "SELECT " + name + " FROM guide_page WHERE id = ?", Object.class, id));
    }
}
