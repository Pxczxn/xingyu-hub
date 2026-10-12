package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommunityFileStorageIntegrationTest {

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
    void anonymousCannotUploadCommunityFile() throws Exception {
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(pngFile("x.png"))
                        .param("purpose", "USER_AVATAR"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void avatarUploadIsPublicAndReadable() throws Exception {
        String token = communityToken();
        MockMultipartFile file = pngFile("avatar.png");

        MvcResult upload = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(file)
                        .param("purpose", "USER_AVATAR")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("public"))
                .andExpect(jsonPath("$.purpose").value("USER_AVATAR"))
                .andReturn();

        JsonNode body = objectMapper.readTree(upload.getResponse().getContentAsString());
        long fileId = body.get("fileId").asLong();
        String url = body.get("url").asText();

        mockMvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(header().exists("Content-Type"));

        mockMvc.perform(get("/api/v1/media/public/" + fileId))
                .andExpect(status().isOk());
    }

    @Test
    void privateArticleBodyImageAuthContract() throws Exception {
        String ownerToken = communityToken();
        String otherToken = communityToken();

        MvcResult upload = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(pngFile("body.png"))
                        .param("purpose", "ARTICLE_BODY_IMAGE")
                        .header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("private"))
                .andReturn();

        long fileId = objectMapper.readTree(upload.getResponse().getContentAsString()).get("fileId").asLong();

        mockMvc.perform(get("/api/v1/media/private/" + fileId))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/media/public/" + fileId))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/media/private/" + fileId).header("satoken", ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/media/private/" + fileId).param("satoken", ownerToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/v1/media/private/" + fileId).header("satoken", otherToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void articleBodyImageVisibleToGuestAfterReviewApproval() throws Exception {
        String ownerToken = communityToken();

        MvcResult upload = mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(pngFile("flow.png"))
                        .param("purpose", "ARTICLE_BODY_IMAGE")
                        .header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andReturn();
        long fileId = objectMapper.readTree(upload.getResponse().getContentAsString()).get("fileId").asLong();
        String privateUrl = "/api/v1/media/private/" + fileId;

        MvcResult created = mockMvc.perform(post("/api/v1/me/articles").header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("articleId")
                .asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"图文发布","summary":"","bodyMode":"MARKDOWN","body":"![插图](%s)","lockVersion":0,"visibility":"PUBLIC"}
                                """.formatted(privateUrl)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit").header("satoken", ownerToken))
                .andExpect(status().isOk());

        String adminToken = adminToken();
        assertTrue(!adminToken.isBlank(), "admin login required for review approval");

        MvcResult queueResult = mockMvc.perform(get("/api/v1/admin/review/queue").header("satoken", adminToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode queueBody = objectMapper.readTree(queueResult.getResponse().getContentAsString());
        JsonNode queue = queueBody.isArray() ? queueBody : queueBody.path("data");
        String submissionId = null;
        for (JsonNode item : queue) {
            if (articleId.equals(item.path("articleId").asText(null))) {
                submissionId = item.path("submissionId").asText(null);
                break;
            }
        }
        assertNotNull(submissionId, "submission not found for article " + articleId);

        mockMvc.perform(post("/api/v1/admin/review/" + submissionId + "/decide")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVED\",\"comment\":\"ok\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/media/public/" + fileId))
                .andExpect(status().isOk());

        String visibility = jdbcTemplate.queryForObject(
                "SELECT visibility FROM sys_file WHERE id = ?", String.class, fileId);
        assertTrue("public".equalsIgnoreCase(visibility), "publish promotes metadata visibility only");
    }

    @Test
    void articleCoverUploadIsPrivateByDefault() throws Exception {
        String token = communityToken();
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(pngFile("cover.png"))
                        .param("purpose", "ARTICLE_COVER")
                        .header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("private"));
    }

    @Test
    void legacyMessagePathRemainsBlockedFromStaticAccess() throws Exception {
        mockMvc.perform(get("/api/v1/admin/files/private/messages/test-user/fake.png"))
                .andExpect(status().isForbidden());
    }

    private String adminToken() throws Exception {
        MvcResult adminLogin = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\"}"))
                .andReturn();
        if (adminLogin.getResponse().getStatus() != 200) {
            return "";
        }
        JsonNode body = objectMapper.readTree(adminLogin.getResponse().getContentAsString());
        return body.path("data").path("token").asText("");
    }

    private String communityToken() throws Exception {
        long nonce = System.nanoTime();
        String email = "file" + nonce + "@example.com";
        String username = "fileuser" + (nonce % 1_000_000_000L);
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
        return loginResult.getResponse().getHeader("satoken");
    }

    private static MockMultipartFile pngFile(String name) throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return new MockMultipartFile("file", name, "image/png", out.toByteArray());
    }
}
