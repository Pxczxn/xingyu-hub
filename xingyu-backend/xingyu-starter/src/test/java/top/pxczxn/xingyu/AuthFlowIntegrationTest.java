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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AuthFlowIntegrationTest {

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
    void registerLoginMeLogoutFlow() throws Exception {
        long nonce = System.nanoTime();
        String email = "flow" + nonce + "@example.com";
        String username = "user" + (nonce % 1_000_000_000L);
        String password = "Test1234!@#ab";

        String registerBody = """
                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                """.formatted(email, username, password);

        MvcResult registerResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode registerJson = objectMapper.readTree(registerResult.getResponse().getContentAsString());
        assertTrue(registerJson.has("userId"));
        assertEquals("NOT_REQUIRED", registerJson.path("emailVerification").path("status").asText());

        String loginBody = """
                {"login":"%s","password":"%s","rememberMe":false}
                """.formatted(email, password);

        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginBody))
                .andExpect(status().isOk())
                .andExpect(header().exists("satoken"))
                .andReturn();

        String token = loginResult.getResponse().getHeader("satoken");
        assertFalse(token.isBlank());

        MvcResult meResult = mockMvc.perform(get("/api/v1/me").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode meJson = objectMapper.readTree(meResult.getResponse().getContentAsString());
        assertEquals(email, meJson.path("email").asText());
        assertFalse(meJson.path("emailVerified").asBoolean());

        mockMvc.perform(get("/api/v1/me/sessions").header("satoken", token))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/auth/logout").header("satoken", token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/me").header("satoken", token))
                .andExpect(status().isUnauthorized());
    }
}
