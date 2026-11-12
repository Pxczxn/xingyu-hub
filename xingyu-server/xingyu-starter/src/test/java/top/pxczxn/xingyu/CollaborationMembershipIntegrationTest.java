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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CollaborationMembershipIntegrationTest {

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
    }

    @Test
    void acceptWritesEditorMembershipAndGrantsDraftEditOnly() throws Exception {
        String ownerToken = register("collab-owner");
        String memberToken = register("collab-member");
        String outsiderToken = register("collab-out");

        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("articleId").asText();

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"共创草稿","bodyMode":"MARKDOWN","body":"初稿","lockVersion":0,"visibility":"PRIVATE"}
                                """))
                .andExpect(status().isOk());

        MvcResult invite = mockMvc.perform(post("/api/v1/me/collaboration-invites")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"note\":\"一起改稿\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(post("/api/v1/collaboration/invites/accept")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isConflict());

        Integer before = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM collaboration_member", Integer.class);

        mockMvc.perform(post("/api/v1/collaboration/invites/accept")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(true));

        Integer afterFirst = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM collaboration_member", Integer.class);
        assertEquals(before + 1, afterFirst);

        mockMvc.perform(post("/api/v1/collaboration/invites/accept")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());

        Integer afterSecond = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM collaboration_member", Integer.class);
        assertEquals(afterFirst, afterSecond);

        mockMvc.perform(get("/api/v1/me/articles/" + articleId).header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("共创草稿"))
                .andExpect(jsonPath("$.collaborationRole").value("EDITOR"));

        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"协作者改过","lockVersion":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("协作者改过"))
                .andExpect(jsonPath("$.collaborationRole").value("EDITOR"));

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/submit")
                        .header("satoken", memberToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/v1/me/articles/" + articleId + "/trash")
                        .header("satoken", memberToken))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/v1/me/articles").header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + articleId + "')].collaborationRole", hasItem("EDITOR")));

        mockMvc.perform(get("/api/v1/me/articles").header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + articleId + "')].collaborationRole", hasItem("OWNER")));

        mockMvc.perform(get("/api/v1/me/articles/" + articleId).header("satoken", outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void editorCanArrangeOwnerSeriesButCannotArchive() throws Exception {
        String ownerToken = register("ser-owner");
        String memberToken = register("ser-member");

        MvcResult createdArticle = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String articleId = objectMapper.readTree(createdArticle.getResponse().getContentAsString())
                .get("articleId").asText();

        MvcResult createdSeries = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"共创系列","slug":"collab-series-%s"}
                                """.formatted(System.nanoTime() % 1_000_000_000L)))
                .andExpect(status().isOk())
                .andReturn();
        var series = objectMapper.readTree(createdSeries.getResponse().getContentAsString());
        String seriesId = series.get("id").asText();
        long lockVersion = series.get("lockVersion").asLong();

        MvcResult invite = mockMvc.perform(post("/api/v1/me/collaboration-invites")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText();
        mockMvc.perform(post("/api/v1/collaboration/invites/accept")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/me/series/" + seriesId).header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collaborationRole").value("EDITOR"));

        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"协作者改过的系列","chapterArticleIds":["%s"],"lockVersion":%d}
                                """.formatted(articleId, lockVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("协作者改过的系列"))
                .andExpect(jsonPath("$.chapters[0].articleId").value(articleId))
                .andExpect(jsonPath("$.collaborationRole").value("EDITOR"));

        mockMvc.perform(put("/api/v1/me/series/" + seriesId)
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"ARCHIVED","lockVersion":%d}
                                """.formatted(lockVersion + 1)))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/me/series").header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id=='" + seriesId + "')].collaborationRole", hasItem("EDITOR")));
    }

    @Test
    void ownerCanRemoveEditorAndMemberCanLeave() throws Exception {
        String ownerToken = register("leave-owner");
        String memberToken = register("leave-member");
        String articleId = createDraft(ownerToken);
        String inviteToken = inviteToken(ownerToken);
        accept(memberToken, inviteToken);

        MvcResult editors = mockMvc.perform(get("/api/v1/me/collaboration-members").header("satoken", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].role").value("EDITOR"))
                .andReturn();
        String memberId = objectMapper.readTree(editors.getResponse().getContentAsString())
                .get(0).get("userId").asText();

        MvcResult hosts = mockMvc.perform(get("/api/v1/me/collaboration-memberships").header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].role").value("EDITOR"))
                .andReturn();
        String ownerId = objectMapper.readTree(hosts.getResponse().getContentAsString())
                .get(0).get("userId").asText();

        mockMvc.perform(delete("/api/v1/me/collaboration-memberships/" + ownerId).header("satoken", memberToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/me/articles/" + articleId).header("satoken", memberToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/me/collaboration-memberships/" + ownerId).header("satoken", memberToken))
                .andExpect(status().isNotFound());

        accept(memberToken, inviteToken);
        mockMvc.perform(delete("/api/v1/me/collaboration-members/" + memberId).header("satoken", ownerToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/me/articles/" + articleId).header("satoken", memberToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/v1/me/collaboration-members/" + memberId).header("satoken", ownerToken))
                .andExpect(status().isNotFound());
    }

    private String createDraft(String ownerToken) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(created.getResponse().getContentAsString()).get("articleId").asText();
    }

    private String inviteToken(String ownerToken) throws Exception {
        MvcResult invite = mockMvc.perform(post("/api/v1/me/collaboration-invites")
                        .header("satoken", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText();
    }

    private void accept(String memberToken, String token) throws Exception {
        mockMvc.perform(post("/api/v1/collaboration/invites/accept")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());
    }

    private String register(String prefix) throws Exception {
        long nonce = System.nanoTime();
        String email = prefix + nonce + "@example.com";
        String username = prefix.replace("-", "") + (nonce % 1_000_000_000L);
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
                .andExpect(header().exists("satoken"))
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }
}
