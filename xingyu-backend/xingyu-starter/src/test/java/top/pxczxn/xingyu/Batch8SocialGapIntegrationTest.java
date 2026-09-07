package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class Batch8SocialGapIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        CommunityTestSupport.ensureSocialGapSchema(jdbcTemplate);
    }

    @Test
    void socialGapApisWork() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String emailA = "b8a" + nonce + "@example.com";
        String usernameA = "b8a" + (nonce % 1_000_000_000L);
        String emailB = "b8b" + nonce + "@example.com";
        String usernameB = "b8b" + (nonce % 1_000_000_000L);

        register(emailA, usernameA, password);
        register(emailB, usernameB, password);
        String tokenA = login(emailA, password);
        String tokenB = login(emailB, password);

        MvcResult momentResult = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"原始动态\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String momentId = objectMapper.readTree(momentResult.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(patch("/api/v1/me/moments/" + momentId)
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"编辑后的动态\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("编辑后的动态"));

        MvcResult commentResult = mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","body":"首条评论"}
                                """.formatted(momentId)))
                .andExpect(status().isOk())
                .andReturn();
        String commentId = objectMapper.readTree(commentResult.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(patch("/api/v1/comments/" + commentId)
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"已编辑评论\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("已编辑评论"));

        mockMvc.perform(delete("/api/v1/comments/" + commentId).header("satoken", tokenA))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/me/blocks/" + usernameB).header("satoken", tokenA))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me/blocks").header("satoken", tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value(usernameB));

        String userBId = jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = ?",
                String.class,
                usernameB);

        mockMvc.perform(post("/api/v1/messages/direct/" + userBId).header("satoken", tokenA))
                .andExpect(status().isConflict());

        MvcResult reportResult = mockMvc.perform(post("/api/v1/reports")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"targetType":"MOMENT","targetId":"%s","reason":"SPAM"}
                                """.formatted(momentId)))
                .andExpect(status().isOk())
                .andReturn();
        String reportId = objectMapper.readTree(reportResult.getResponse().getContentAsString()).path("id").asText();

        mockMvc.perform(post("/api/v1/me/reports/" + reportId + "/supplements")
                        .header("satoken", tokenA)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"补充举报材料\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("补充举报材料"));

        mockMvc.perform(post("/api/v1/me/moments/" + momentId + "/trash").header("satoken", tokenA))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/v1/me/blocks/" + usernameB).header("satoken", tokenA))
                .andExpect(status().isNoContent());
    }

    private void register(String email, String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
    }

    private String login(String email, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();
        return loginResult.getResponse().getHeader("satoken");
    }
}
