package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 个人主页的公开系列（2026-10-30）：{@code GET /api/v1/users/{username}/series}。
 *
 * <p>为什么需要它：主页身份带显示资料 DTO 的 {@code seriesCount}，列表来自这个端点。
 * 两者必须是同一个集合，否则会出现「系列 3」下面只有 1 条、或者已归档的系列仍然可点。
 * 三条契约在这里钉住：
 * <ol>
 *   <li>只含 ACTIVE 且有作者档案的系列（可见性复用广场那一条 SQL）；</li>
 *   <li>keyset 分页逐页取完不重不漏，末页 {@code nextCursor} 为 null；</li>
 *   <li>未知用户 404——与资料详情一致。</li>
 * </ol>
 *
 * <p>PRIVATE 档案的 404 由 {@code ProfilePrivacyIntegrationTest} 覆盖，这里不重复。
 * 数据全部通过公开接口创建，不写裸 SQL。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProfileSeriesIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("公开主页系列按游标翻页：逐页取完不重不漏，末页 nextCursor 为 null")
    void pagesActiveSeriesByCursor() throws Exception {
        Account author = registerAccount("pseries");
        makeProfilePublic(author.token());
        String first = createSeries(author.token(), "ps-one");
        String second = createSeries(author.token(), "ps-two");
        String third = createSeries(author.token(), "ps-three");

        JsonNode page1 = seriesPage(author.username(), 2, null);
        assertEquals(2, page1.path("items").size(), "limit=2 的第一页应有两行");
        JsonNode cursorNode = page1.path("nextCursor");
        assertTrue(cursorNode.isTextual(), "总共有三条时第一页必须给出下一页游标");
        String cursor = cursorNode.asText();

        JsonNode page2 = seriesPage(author.username(), 2, cursor);
        assertEquals(1, page2.path("items").size(), "第二页只应剩下一行");
        assertTrue(page2.path("nextCursor").isNull(), "末页的 nextCursor 必须是 null");

        Set<String> ids = new LinkedHashSet<>();
        page1.path("items").forEach(row -> ids.add(row.path("id").asText()));
        page2.path("items").forEach(row -> ids.add(row.path("id").asText()));
        assertEquals(Set.of(first, second, third), ids, "两页合起来必须恰好是三条不同系列");

        // 每行都带作者与章节数：主页卡片直接渲染它们，不需要再逐条查详情。
        JsonNode row = page1.path("items").get(0);
        assertEquals(author.username(), row.path("author").path("username").asText());
        assertTrue(row.has("chapterCount"), "列表项必须带 chapterCount");
        assertTrue(row.has("slug"), "列表项必须带 slug");
    }

    @Test
    @DisplayName("已归档系列不再出现在公开主页系列里")
    void archivedSeriesDisappears() throws Exception {
        Account author = registerAccount("pseriesarch");
        makeProfilePublic(author.token());
        String kept = createSeries(author.token(), "ps-kept");
        SeriesRef archived = createSeriesRef(author.token(), "ps-archived");

        assertEquals(2, seriesPage(author.username(), 10, null).path("items").size(),
                "归档前两条都应出现");

        archiveSeries(author.token(), archived);

        JsonNode after = seriesPage(author.username(), 10, null);
        assertEquals(1, after.path("items").size(), "归档后只剩一条");
        assertEquals(kept, after.path("items").get(0).path("id").asText());
        assertTrue(after.path("nextCursor").isNull());
    }

    @Test
    @DisplayName("不存在的用户请求主页系列返回 404")
    void unknownUsernameReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/users/no_such_user_" + uniqueSuffix() + "/series"))
                .andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- helpers

    private JsonNode seriesPage(String username, int limit, String cursor) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/users/" + username + "/series")
                .param("limit", Integer.toString(limit));
        if (cursor != null) request = request.param("cursor", cursor);
        MvcResult result = mockMvc.perform(request).andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String createSeries(String token, String slug) throws Exception {
        return createSeriesRef(token, slug).id();
    }

    private SeriesRef createSeriesRef(String token, String slug) throws Exception {
        MvcResult created = mockMvc.perform(post("/api/v1/me/series")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"主页系列 " + slug + "\",\"slug\":\"" + slug + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(created.getResponse().getContentAsString(StandardCharsets.UTF_8));
        return new SeriesRef(body.path("id").asText(), body.path("lockVersion").asLong());
    }

    private void archiveSeries(String token, SeriesRef series) throws Exception {
        mockMvc.perform(put("/api/v1/me/series/" + series.id())
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\",\"lockVersion\":" + series.lockVersion() + "}"))
                .andExpect(status().isOk());
    }

    private void makeProfilePublic(String token) throws Exception {
        mockMvc.perform(patch("/api/v1/me/profile")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"PUBLIC\",\"lockVersion\":0}"))
                .andExpect(status().isOk());
    }

    private Account registerAccount(String prefix) throws Exception {
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
                .andReturn();
        return new Account(username, login.getResponse().getHeader("satoken"));
    }

    private static String uniqueSuffix() {
        return Long.toString(System.nanoTime() % 1_000_000_000L);
    }

    private record Account(String username, String token) {
    }

    private record SeriesRef(String id, long lockVersion) {
    }
}
