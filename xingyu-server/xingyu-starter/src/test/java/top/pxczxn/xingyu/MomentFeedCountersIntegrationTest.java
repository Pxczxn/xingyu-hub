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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 动态 feed 上的互动计数（{@code likeCount} / {@code commentCount} / {@code liked}）。
 *
 * <p>为什么需要它：这三个字段没有一个能在编译期验证。
 * <ul>
 *   <li>{@code EngagementMetricsService} 的三个批量方法走的是 {@code ObjectCountRow}
 *       的<b>构造器自动映射</b>——列别名与构造参数名不一致时不会报错，只会静默得到空 Map，
 *       最终表现为「每张卡都是 0 赞 0 评论」，而 0 恰好是一个看起来合理的值；</li>
 *   <li>{@code objectType} 是自由字符串（{@code SocialService.validateObjectType} 只校验
 *       非空），写成 {@code "moments"} 或 {@code "Moment"} 都不会抛异常，只会查不到行；</li>
 *   <li>{@code liked} 依赖 {@code CommunityAuthContext} 在公开读端口上被填充。这条链路跨了
 *       拦截器 / service / DTO 三层，任何一层断开都只表现为「永远没有已点赞状态」。</li>
 * </ul>
 * 所以这里用真实库 + 真实 HTTP 跑一遍，并直接断言<b>值</b>。
 *
 * <p>刻意<b>不</b>用 {@code jsonPath("$[?(@.id=='...')].likeCount").value(1)}：过滤表达式在
 * 没有匹配行时返回空数组，{@code value(1)} 的失败信息会是「expected 1 but was []」，
 * 而当它「通过」时也可能只是匹配到了别的行。这里先按 id 取出整行节点，匹配不到就显式失败。
 *
 * <p>数据全部通过公开接口创建，不写裸 SQL——测试库的结构由 {@code sql/rebuild-test-db.sh}
 * 维护，测试源码禁止出现结构语句（由 {@code TestSourceSchemaMutationGuardTest} 强制）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MomentFeedCountersIntegrationTest {

    /** 与 {@code CommunityMomentController#list} 的默认值一致，但这里放大以便在真实库里找到目标行。 */
    private static final int FEED_LIMIT = 50;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SysConfigGroupService configGroupService;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
    }

    @Test
    @DisplayName("feed 上的点赞数与评论数来自批量聚合，而不是逐条查")
    void feedCarriesBatchedCounters() throws Exception {
        String authorToken = registerAndLogin("mcntauthor");
        String momentId = publishMoment(authorToken, "计数聚合的集成验证");

        // 另一个用户点赞 + 评论，让两个计数都非零 ——
        // 零值无法区分「查对了」和「objectType 写错了所以查不到」。
        String fanToken = registerAndLogin("mcntfan");
        mockMvc.perform(post("/api/v1/likes/MOMENT/" + momentId).header("satoken", fanToken))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/comments")
                        .header("satoken", fanToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"objectType":"MOMENT","objectId":"%s","body":"计数验证评论"}
                                """.formatted(momentId)))
                .andExpect(status().isOk());

        JsonNode row = feedRow(fanToken, momentId);
        assertEquals(1, row.get("likeCount").asInt(), "点赞数应为 1");
        assertEquals(1, row.get("commentCount").asInt(), "可见评论数应为 1");
        assertTrue(row.get("liked").asBoolean(), "点赞者看到自己的点赞状态必须为 true");
    }

    @Test
    @DisplayName("游客得到 liked=null 而不是 false（未知与「没赞过」是两件事）")
    void guestGetsNullLikedRatherThanFalse() throws Exception {
        String authorToken = registerAndLogin("mgestauthor");
        String momentId = publishMoment(authorToken, "游客状态字段的验证");

        JsonNode row = feedRow(null, momentId);

        assertNotNull(row.get("likeCount"), "游客也要看到时长，点赞数必须返回");
        assertEquals(0, row.get("likeCount").asInt(), "还没有人点赞");
        assertNotNull(row.get("liked"), "liked 字段必须存在（序列化为 null，而不是省略）");
        assertTrue(row.get("liked").isNull(),
                "游客的 liked 必须是 null；塌缩成 false 会让前端把「未登录」渲染成「未点赞」");
    }

    @Test
    @DisplayName("single-moment 端点不带计数，计数只属于列表")
    void singleMomentEndpointDoesNotCarryCounters() throws Exception {
        String authorToken = registerAndLogin("msingleauthor");
        String momentId = publishMoment(authorToken, "单条端点不带计数");

        MvcResult result = mockMvc.perform(get("/api/v1/moments/" + momentId).header("satoken", authorToken))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode row = objectMapper.readTree(result.getResponse().getContentAsString());

        // 这条断言钉住的是一个【取舍】，不是缺陷：详情页的互动由 ArticleInteractions
        // 自己按 id 请求，不需要列表那套批量字段。若将来把它补上，这条测试应当被改写，
        // 而不是被删掉——它存在的意义是让那次改动成为一次有意识的决定。
        //
        // 断言写成 has(...) && isNull() 而不是 `get(...) == null || isNull()`：后者在
        // 字段根本不存在时也成立，于是「字段没接上」会被当成「字段是 null」而放行。
        assertTrue(row.has("likeCount"), "likeCount 字段必须出现在 JSON 里（值为 null 也要出现）");
        assertTrue(row.get("likeCount").isNull(), "single-moment 端点当前不填计数；实际=" + row.get("likeCount"));
        assertFalse(row.hasNonNull("liked"), "single-moment 端点当前不填 liked");
    }

    // ---------------------------------------------------------------- helpers

    /** 发一条动态并返回它的 id。 */
    private String publishMoment(String token, String body) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/moments")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"%s\"}".formatted(body)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText();
    }

    /**
     * 从公开 feed 里按 id 取出整行。
     *
     * @param token 为 null 时就是游客请求——公开 feed 不要求登录，这正是要验证的分支。
     */
    private JsonNode feedRow(String token, String momentId) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/moments").param("limit", Integer.toString(FEED_LIMIT));
        if (token != null) {
            request = request.header("satoken", token);
        }
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();

        JsonNode rows = objectMapper.readTree(result.getResponse().getContentAsString());
        for (JsonNode row : rows) {
            if (momentId.equals(row.path("id").asText())) {
                return row;
            }
        }
        throw new AssertionError("公开 feed 里没有找到刚发布的动态 " + momentId + "（limit=" + FEED_LIMIT + "）");
    }

    private String registerAndLogin(String prefix) throws Exception {
        String username = prefix + uniqueSuffix();
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

    /** Usernames must match [a-z0-9_] and stay unique across runs. */
    private static String uniqueSuffix() {
        return Long.toString(System.nanoTime() % 1_000_000_000L);
    }
}
