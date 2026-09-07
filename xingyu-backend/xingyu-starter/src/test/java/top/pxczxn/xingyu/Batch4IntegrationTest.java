package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
class Batch4IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SysConfigGroupService configGroupService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void creationSpaceCategoriesAndReAuthFlow() throws Exception {
        long nonce = System.nanoTime();
        String email = "b4" + nonce + "@example.com";
        String username = "b4user" + (nonce % 1_000_000_000L);
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

        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"PUBLIC\",\"lockVersion\":0}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/users/" + username + "/works").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.owner").value(true));

        mockMvc.perform(post("/api/v1/me/email/change")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"newEmail":"new%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isForbidden());

        MvcResult reAuthResult = mockMvc.perform(post("/api/v1/auth/re-authenticate")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"password":"%s"}
                                """.formatted(password)))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode reAuthJson = objectMapper.readTree(reAuthResult.getResponse().getContentAsString());
        String recentAuthId = reAuthJson.path("recentAuthId").asText();
        assertFalse(recentAuthId.isBlank());

        mockMvc.perform(get("/api/v1/me/account-status").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canChangeEmail").value(true));

        MvcResult createCategory = mockMvc.perform(post("/api/v1/me/creation-space/categories")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"随笔","slug":"notes"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("notes"))
                .andReturn();

        String categoryId = objectMapper.readTree(createCategory.getResponse().getContentAsString())
                .path("id")
                .asText();

        mockMvc.perform(get("/api/v1/me/creation-space/categories").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(get("/api/v1/users/" + username + "/works/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(patch("/api/v1/me/creation-space/categories/" + categoryId)
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"ARCHIVED","lockVersion":0}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

        mockMvc.perform(delete("/api/v1/me/creation-space/categories/" + categoryId)
                        .header("satoken", token))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/me/email/change")
                        .header("satoken", token)
                        .header("X-Recent-Auth", recentAuthId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"newEmail":"new%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk());
    }
}
