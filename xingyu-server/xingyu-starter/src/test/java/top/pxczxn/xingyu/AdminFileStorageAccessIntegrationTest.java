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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminFileStorageAccessIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
    }

    @Test
    void anonymousCannotPreviewPrivateCommunityFileById() throws Exception {
        String token = communityToken();
        MockMultipartFile file = pngFile("secret.png");

        MvcResult upload = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .param("purpose", "MESSAGE_ATTACHMENT")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode body = objectMapper.readTree(upload.getResponse().getContentAsString());
        long fileId = body.get("fileId").asLong();

        // admin 端点沿用项目统一响应包络：未登录是 HTTP 200 + body.code=401，
        // 不是社区媒体端点那种真实 HTTP 401。这里断言 JSON 错误包络，
        // 同时证明响应体不是文件字节。
        mockMvc.perform(get("/api/v1/admin/sys/file/preview/" + fileId))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(401));

        mockMvc.perform(get("/api/v1/admin/sys/file/download/" + fileId))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value(401));
    }

    @Test
    void anonymousCannotReadPrivateMediaEndpoint() throws Exception {
        String token = communityToken();
        MvcResult upload = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(pngFile("body.png"))
                        .param("purpose", "ARTICLE_BODY_IMAGE")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        long fileId = objectMapper.readTree(upload.getResponse().getContentAsString()).get("fileId").asLong();

        mockMvc.perform(get("/api/v1/media/private/" + fileId))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/media/public/" + fileId))
                .andExpect(status().isNotFound());
    }

    private String communityToken() throws Exception {
        long nonce = System.nanoTime();
        String email = "admfile" + nonce + "@example.com";
        String username = "admfile" + (nonce % 1_000_000_000L);
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
                .andReturn();
        return loginResult.getResponse().getHeader("satoken");
    }

    private static MockMultipartFile pngFile(String name) throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new MockMultipartFile("file", name, "image/png", out.toByteArray());
    }
}
