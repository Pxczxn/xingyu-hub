package top.pxczxn.xingyu;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(org.junit.jupiter.api.TestInstance.Lifecycle.PER_CLASS)
class Batch5IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    /** 本测试插入的他人 moment（举报目标），teardown 清理。 */
    private String seededMomentId;

    @AfterAll
    void tearDown() {
        if (seededMomentId != null) {
            jdbcTemplate.update("DELETE FROM moderation_case WHERE report_id IN (SELECT id FROM report WHERE object_id = ? AND object_type = 'MOMENT')", seededMomentId);
            jdbcTemplate.update("DELETE FROM report WHERE object_id = ? AND object_type = 'MOMENT'", seededMomentId);
            jdbcTemplate.update("DELETE FROM moment WHERE id = ?", seededMomentId);
        }
    }

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void momentsHomeDiscoverAndCollectionsFlow() throws Exception {
        long nonce = System.nanoTime();
        String email = "b5" + nonce + "@example.com";
        String username = "b5user" + (nonce % 1_000_000_000L);
        String password = "Test1234!@#ab";

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();

        String token = loginResult.getResponse().getHeader("satoken");

        mockMvc.perform(get("/api/v1/moments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"联调测试动态\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("联调测试动态"));

        mockMvc.perform(get("/api/v1/me/home").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.continueReading").isArray())
                .andExpect(jsonPath("$.followUpdates").isArray())
                .andExpect(jsonPath("$.recommendations").isArray());

        mockMvc.perform(get("/api/v1/discover"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        mockMvc.perform(get("/api/v1/me/collections").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/v1/me/reading-history").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());

        // 举报契约（GovernanceContractRecovery，2026-10）：对象必须真实存在且不能
        // 举报自己。旧断言用假 ID「demo-article」期望 200，与该契约冲突（真实行为 404）。
        // 这里插入一行「他人」moment 作为真实举报目标，保持举报→/me/reports 流程断言。
        seededMomentId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO moment (id, author_id, status, created_at, updated_at)
                VALUES (?, ?, 'PUBLISHED', NOW(), NOW())
                """, seededMomentId, "b5-other-author-" + (nonce % 1_000_000_000L));

        mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"MOMENT","targetId":"%s","reason":"SPAM"}
                                """.formatted(seededMomentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));

        mockMvc.perform(get("/api/v1/me/reports").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].targetType").value("MOMENT"));
    }
}
