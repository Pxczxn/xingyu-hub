package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class Batch7GrowthIntegrationTest {

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
        CommunityTestSupport.ensureGrowthSchema(jdbcTemplate);
    }

    @Test
    void seoFeedsRecommendationAndOpenApiFlow() throws Exception {
        long nonce = System.nanoTime();
        String email = "b7" + nonce + "@example.com";
        String username = "b7user" + (nonce % 1_000_000_000L);
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

        mockMvc.perform(get("/api/v1/me/home").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendations").isArray());

        mockMvc.perform(put("/api/v1/me/client-settings")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"personalizedRecommendationEnabled\":false}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/sitemap.xml"))
                .andExpect(status().isOk());

        MvcResult sitemap = mockMvc.perform(get("/api/v1/sitemap.xml"))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(sitemap.getResponse().getContentAsString().contains("<urlset"));

        MvcResult rss = mockMvc.perform(get("/api/v1/feed.xml"))
                .andExpect(status().isOk())
                .andReturn();
        assertTrue(rss.getResponse().getContentAsString().contains("<rss"));

        MvcResult createToken = mockMvc.perform(post("/api/v1/me/api-tokens")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"联调 Token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andReturn();

        String apiToken = objectMapper.readTree(createToken.getResponse().getContentAsString())
                .path("token")
                .asText();
        assertFalse(apiToken.isBlank());

        mockMvc.perform(get("/api/v1/open/profile")
                        .header("Authorization", "Bearer " + apiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username));

        mockMvc.perform(get("/api/v1/open/articles")
                        .header("Authorization", "Bearer " + apiToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        String tokenId = objectMapper.readTree(createToken.getResponse().getContentAsString())
                .path("id")
                .asText();
        mockMvc.perform(delete("/api/v1/me/api-tokens/" + tokenId).header("satoken", token))
                .andExpect(status().isNoContent());
    }
}
