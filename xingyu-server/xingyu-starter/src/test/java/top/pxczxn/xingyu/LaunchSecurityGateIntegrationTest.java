package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import top.pxczxn.xingyu.system.helper.SystemConfigHelper;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class LaunchSecurityGateIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;
    @Autowired
    private SystemConfigHelper configHelper;
    @LocalServerPort
    private int port;
    private final List<String> ordinaryCommunityUserIds = new ArrayList<>();

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    void adminFilesRequireAdminRoleWhilePublicMediaStaysReadable() throws Exception {
        String relative = "public/security-probe-" + System.nanoTime() + ".txt";
        Path file = Paths.get(configHelper.getStorageLocalPath()).toAbsolutePath().normalize().resolve(relative);
        Files.createDirectories(file.getParent());
        byte[] payload = "admin-only".getBytes(StandardCharsets.UTF_8);
        Files.write(file, payload);
        long ordinaryUserId = 961_100L;
        try {
            mockMvc.perform(get("/api/v1/admin/files/" + relative))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(401));

            String ordinaryToken = seedOrdinaryUser(ordinaryUserId);
            mockMvc.perform(get("/api/v1/admin/files/" + relative).header("satoken", ordinaryToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(403));

            String adminToken = adminToken();
            mockMvc.perform(get("/api/v1/admin/files/" + relative).header("satoken", adminToken))
                    .andExpect(status().isOk())
                    .andExpect(content().bytes(payload));

            mockMvc.perform(get("/api/v1/admin/files/private/messages/hidden.png").header("satoken", adminToken))
                    .andExpect(status().isForbidden());

            String communityToken = communityToken();
            MvcResult avatar = mockMvc.perform(multipart("/api/v1/files/upload")
                            .file(png("avatar.png"))
                            .param("purpose", "USER_AVATAR")
                            .header("satoken", communityToken))
                    .andExpect(status().isOk())
                    .andReturn();
            String avatarUrl = objectMapper.readTree(avatar.getResponse().getContentAsString()).path("url").asText();
            mockMvc.perform(get(avatarUrl)).andExpect(status().isOk());

            MvcResult cover = mockMvc.perform(multipart("/api/v1/files/upload")
                            .file(png("cover.png"))
                            .param("purpose", "SERIES_COVER")
                            .header("satoken", communityToken))
                    .andExpect(status().isOk())
                    .andReturn();
            String coverUrl = objectMapper.readTree(cover.getResponse().getContentAsString()).path("url").asText();
            mockMvc.perform(get(coverUrl)).andExpect(status().isOk());
        } finally {
            Files.deleteIfExists(file);
            deleteOrdinaryCommunityUsers();
        }
    }

    @Test
    void developmentProfileStillReflectsRequestOrigin() throws Exception {
        mockMvc.perform(get("/api/v1/health").header(HttpHeaders.ORIGIN, "http://localhost:7777"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:7777"));
    }

    @Test
    void sshSocketRequiresAdminAndMessageSocketKeepsExistingLoginCheck() throws Exception {
        long ordinaryUserId = 961_101L;
        try {
            String ordinaryToken = seedOrdinaryUser(ordinaryUserId);
            String admin = adminToken();
            String community = communityToken();

            assertThrows(ExecutionException.class, () -> openSocket("/ws/ssh", ordinaryToken));
            assertThrows(ExecutionException.class, () -> openSocket("/ws/ssh", community));

            try (WebSocketSession adminSsh = openSocket("/ws/ssh", admin)) {
                assertTrue(adminSsh.isOpen());
            }
            try (WebSocketSession message = openSocket("/ws/message", ordinaryToken)) {
                assertTrue(message.isOpen());
            }
            try (WebSocketSession chat = openSocket("/ws/community/chat", community)) {
                assertTrue(chat.isOpen());
            }
        } finally {
            deleteOrdinaryCommunityUsers();
        }
    }

    private void deleteOrdinaryCommunityUsers() {
        for (String userId : ordinaryCommunityUserIds) {
            jdbcTemplate.update("DELETE FROM community_user_role WHERE community_user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        ordinaryCommunityUserIds.clear();
    }

    private WebSocketSession openSocket(String path, String token) throws Exception {
        String url = "ws://127.0.0.1:" + port + path + "?token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8);
        return new StandardWebSocketClient()
                .execute(new TextWebSocketHandler() {}, url)
                .get(10, TimeUnit.SECONDS);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    private String seedOrdinaryUser(long id) throws Exception {
        String username = "ordinary" + id;
        String userId = CommunityTestSupport.insertActiveCommunityUser(jdbcTemplate, username, "admin123");
        ordinaryCommunityUserIds.add(userId);
        return CommunityTestSupport.loginThenRevokeAdmin(
                mockMvc, objectMapper, jdbcTemplate, userId, username, "admin123");
    }

    private String communityToken() throws Exception {
        long nonce = System.nanoTime();
        String email = "launch" + nonce + "@example.com";
        String username = "launch" + (nonce % 1_000_000_000L);
        String password = "Test1234!@#ab";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","username":"%s","password":"%s","termsVersion":"1.0"}
                                """.formatted(email, username, password)))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"login":"%s","password":"%s","rememberMe":false}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }

    private static MockMultipartFile png(String name) throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new MockMultipartFile("file", name, "image/png", out.toByteArray());
    }
}
