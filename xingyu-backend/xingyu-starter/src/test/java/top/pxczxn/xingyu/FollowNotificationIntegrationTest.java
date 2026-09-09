package top.pxczxn.xingyu;

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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class FollowNotificationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void followCreatesNotificationForFollowee() throws Exception {
        long nonce = System.nanoTime();
        String password = "Test1234!@#ab";
        String emailA = "fna" + nonce + "@example.com";
        String usernameA = "fna" + (nonce % 1_000_000_000L);
        String emailB = "fnb" + nonce + "@example.com";
        String usernameB = "fnb" + (nonce % 1_000_000_000L);

        register(emailA, usernameA, password);
        register(emailB, usernameB, password);
        String tokenA = login(emailA, password);
        String tokenB = login(emailB, password);

        mockMvc.perform(post("/api/v1/users/" + usernameB + "/follow").header("satoken", tokenA))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/notifications").header("satoken", tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].category").value("FOLLOW"))
                .andExpect(jsonPath("$[0].read").value(false))
                .andExpect(jsonPath("$[0].title").value(org.hamcrest.Matchers.containsString("关注了你")));
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
