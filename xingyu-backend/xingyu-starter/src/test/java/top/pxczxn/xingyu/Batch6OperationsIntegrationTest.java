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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class Batch6OperationsIntegrationTest {

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
    void adminOperationsGalaxyEventAndAnnouncementFlow() throws Exception {
        String adminToken = adminToken();
        long nonce = System.nanoTime();

        mockMvc.perform(get("/api/v1/admin/community/events")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        MvcResult createEvent = mockMvc.perform(post("/api/v1/admin/community/events")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"联调活动","slug":"ops-%s","body":"活动正文","submissionOpen":true}
                                """.formatted(nonce)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").isString())
                .andReturn();

        String eventId = objectMapper.readTree(createEvent.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asText();

        mockMvc.perform(get("/api/v1/admin/community/events/" + eventId + "/submissions")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        MvcResult createGalaxy = mockMvc.perform(post("/api/v1/admin/community/galaxies")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"联调星系","slug":"galaxy-%s","official":true}
                                """.formatted(nonce)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("galaxy-" + nonce))
                .andReturn();

        String galaxyId = objectMapper.readTree(createGalaxy.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asText();

        mockMvc.perform(patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"联调星系更新\",\"official\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.name").value("联调星系更新"));

        MvcResult createAnnouncement = mockMvc.perform(post("/api/v1/admin/operations/announcements")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"联调公告","body":"公告正文"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andReturn();

        String announcementId = objectMapper.readTree(createAnnouncement.getResponse().getContentAsString())
                .path("data")
                .path("id")
                .asText();

        mockMvc.perform(patch("/api/v1/admin/operations/announcements/" + announcementId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ARCHIVED"));

        mockMvc.perform(get("/api/v1/events/" + eventId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("联调活动"));

        mockMvc.perform(get("/api/v1/events/" + eventId + "/submissions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data")
                .path("token")
                .asText();
        assertFalse(token.isBlank(), "管理员登录必须返回可用 token");
        return token;
    }
}
