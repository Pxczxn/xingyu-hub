package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.service.HomeFeedEnrichmentService;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 首页 feed 富化的集成测试。
 *
 * <p>覆盖的是 2026-09-29 新增的那条链路：{@code HomeService} 组装 rail 后交给
 * {@link HomeFeedEnrichmentService} 补齐「作者名 / 头像 / 点赞数 / 评论数 / 话题标签」。
 *
 * <p>为什么需要它：这些字段里没有一个是编译期能验证的。
 * <ul>
 *   <li>{@code CommentMapper.countByObjectIds}、{@code ArticleTopicMapper.listTopicNamesByArticleIds}
 *       是新增的 {@code @Select}，SQL 写错只会在运行时炸；</li>
 *   <li>{@code ArticleTopicNameRow} 靠 MyBatis 的<b>构造器自动映射</b>绑定列别名，
 *       别名与构造参数名不一致时不会报错，只会静默得到 null；</li>
 *   <li>作者解析要穿过 objectType → owner → profile 三层，任何一层接错都只表现为「作者是空的」。</li>
 * </ul>
 * 所以这里用真实库 + 真实 HTTP 跑一遍，并直接断言<b>值</b>，而不是只断言「没抛异常」。
 *
 * <p>数据全部通过公开接口创建（文章走 draft 的 {@code topicIds} 关联话题，点赞/评论走各自端点），
 * 不写任何裸 SQL —— 测试源码禁止包含结构语句，且这里也没有需要绕开接口的理由。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HomeFeedEnrichmentIntegrationTest {

    /** 迁移 V021 种子的一个话题（技术），用于验证标签链路。 */
    private static final String SEEDED_TOPIC_ID = "01900000-0000-7000-8000-000000000003";
    private static final String SEEDED_TOPIC_NAME = "技术";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private HomeFeedEnrichmentService enrichmentService;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        TestSchemaAssertions.of(jdbcTemplate).assertDriftProneBaseline();
    }

    @Test
    @DisplayName("游客首页组装在真实库上跑通（富化链路不抛异常）")
    void guestHomeCompositionRuns() throws Exception {
        mockMvc.perform(get("/api/v1/home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.discoveries").isArray())
                .andExpect(jsonPath("$.followingUpdates").isArray());
    }

    @Test
    @DisplayName("登录态首页组装在真实库上跑通，且五个 rail 都在")
    void memberHomeCompositionRuns() throws Exception {
        String token = registerAndLogin("homerail");

        mockMvc.perform(get("/api/v1/me/home").header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.continueReading").isArray())
                .andExpect(jsonPath("$.followUpdates").isArray())
                .andExpect(jsonPath("$.recommendations").isArray())
                .andExpect(jsonPath("$.draftArticles").isArray())
                .andExpect(jsonPath("$.pendingActions").isArray());
    }

    @Test
    @DisplayName("富化能解析出作者名、点赞数、评论数与话题标签")
    void enrichmentResolvesAuthorCountersAndTags() throws Exception {
        String authorName = "homeenrichauthor" + uniqueSuffix();
        String authorToken = registerAndLoginWithUsername(authorName);

        String articleId = createDraft(authorToken, "富化验证文章", List.of(SEEDED_TOPIC_ID));

        // 另一个用户点赞 + 评论，让两个计数都非零 —— 零值无法区分「查对了」和「根本没查到」。
        String otherToken = registerAndLogin("homeenrichfan");
        mockMvc.perform(post("/api/v1/likes/ARTICLE/" + articleId).header("satoken", otherToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"ARTICLE","objectId":"%s","body":"集成测试评论"}
                                """.formatted(articleId)))
                .andExpect(status().isOk());

        Map<String, HomeFeedEnrichmentService.Presentation> enriched = enrichmentService.enrich(
                List.of(new HomeFeedEnrichmentService.FeedObject("ARTICLE", articleId)),
                // No viewer. `bookmarked` is viewer-scoped, so a guest must get null rather
                // than false — see the assertion below. The signed-in true/false cases are
                // covered end-to-end by SearchIndexPipelineIntegrationTest.
                null);
        HomeFeedEnrichmentService.Presentation presentation =
                enriched.get(HomeFeedEnrichmentService.key("ARTICLE", articleId));

        assertNotNull(presentation, "富化结果里必须有这条 ARTICLE 的记录");

        // 作者解析：objectType -> article.owner_id -> community_profile
        assertEquals(authorName, presentation.authorName(),
                "作者名应当解析为发布者的 username（该用户没有 displayName）");

        // 两个批量计数各自独立命中
        assertEquals(1L, presentation.likeCount(), "点赞数应当为 1");
        assertEquals(1L, presentation.commentCount(), "可见评论数应当为 1");

        // 标签走 article_topic -> topic.name 的批量连表，并且依赖构造器自动映射
        assertTrue(presentation.tags().contains(SEEDED_TOPIC_NAME),
                "标签里应当包含关联话题名，实际=" + presentation.tags());

        // 访客：不知道「有没有收藏过」，必须是 null 而不是 false ——
        // 否则游客会看到一个「未收藏」的按钮状态，而那可能是错的。
        assertNull(presentation.bookmarked(),
                "没有登录用户时 bookmarked 必须是 null（未知），不能塌缩成 false");
    }

    // ---------------------------------------------------------------- helpers

    private String registerAndLogin(String prefix) throws Exception {
        return registerAndLoginWithUsername(prefix + uniqueSuffix());
    }

    private String registerAndLoginWithUsername(String username) throws Exception {
        String email = username + "@example.com";
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

    /** Creates a draft and returns its id. Topics are linked through the draft payload. */
    private String createDraft(String token, String title, List<String> topicIds) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/articles")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode createdBody = objectMapper.readTree(created.getResponse().getContentAsString());
        String articleId = createdBody.get("articleId").asText();

        String topicIdsJson = objectMapper.writeValueAsString(topicIds);
        mockMvc.perform(put("/api/v1/me/articles/" + articleId + "/draft")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"%s","summary":"摘要","bodyMode":"MARKDOWN","body":"正文","lockVersion":0,"visibility":"PUBLIC","topicIds":%s}
                                """.formatted(title, topicIdsJson)))
                .andExpect(status().isOk());

        return articleId;
    }

    /** Usernames must match [a-z0-9_] and stay unique across runs. */
    private static String uniqueSuffix() {
        return Long.toString(System.nanoTime() % 1_000_000_000L);
    }
}
