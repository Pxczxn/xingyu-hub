package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
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
import org.apache.ibatis.annotations.Select;
import top.pxczxn.xingyu.community.mapper.AnnouncementMapper;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 公开公告列表的排序稳定性。
 *
 * <p>背景：{@code published_at} 是 timestamp（秒精度），同秒发布的多条公告在该列上完全相等。
 * 只按 {@code published_at DESC} 排序时 MySQL 不保证两次读取给同一顺序，列表会自己重排。
 * mapper 现在加 {@code id DESC} 作为纯技术 tie-breaker。
 *
 * <p>本测试只锁两件它**真的承诺**的事：
 * <ol>
 *   <li>数据不变时，重复读取给出**完全相同**的顺序（stable）；</li>
 *   <li>同 {@code published_at} 的一组，内部按 {@code id DESC} 排列。</li>
 * </ol>
 * <b>刻意不</b>断言同秒组在整张列表里"连续相邻"—— 该组之外还可能有其它时间戳的行夹在中间，
 * 相邻性从来不是契约。也<b>不</b>断言 id 的字典序等于真实发布先后（那是它不承诺的事）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AnnouncementOrderingIntegrationTest {

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
        jdbcTemplate.update("DELETE FROM announcement WHERE title LIKE 'SORTTEST-%'");
    }

    @AfterEach
    void tearDown() {
        // 本类造的数据必须自己清掉，不能留给后续用例 —— 否则会污染别人的公开列表断言。
        jdbcTemplate.update("DELETE FROM announcement WHERE title LIKE 'SORTTEST-%'");
    }

    @Test
    void samePublishedAtRowsComeBackInAStableOrderOnRepeatedReads() throws Exception {
        String adminToken = adminToken();
        String sharedSecond = "2026-01-02 03:04:05";

        // 5 条同 published_at 的已发布公告 + 1 条更早的作为对照。
        List<String> sameSecondIds = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            sameSecondIds.add(insertPublished(adminToken, "SORTTEST-same-" + i, sharedSecond));
        }
        insertPublished(adminToken, "SORTTEST-older", "2025-12-31 23:59:59");

        List<String> first = publicIds(adminToken);
        List<String> second = publicIds(adminToken);
        List<String> third = publicIds(adminToken);

        // 1) 可重复：三次读取完全同序。
        assertEquals(first, second, "同 published_at 的公开列表两次读取必须同序");
        assertEquals(second, third, "第三次读取也必须是同一顺序");

        // 2) 同秒组内部按 id DESC。
        List<String> expectedGroupOrder = new ArrayList<>(sameSecondIds);
        expectedGroupOrder.sort(Comparator.reverseOrder());
        assertEquals(expectedGroupOrder, filterTo(first, sameSecondIds),
                "同 published_at 的一组必须按 id DESC 排列");

        // 3) 更早发布的那条排在整个同秒组之后。
        int olderIdx = indexOfTitle(adminToken, "SORTTEST-older");
        int sameSecondTail = first.indexOf(expectedGroupOrder.get(0));
        assertTrue(olderIdx > sameSecondTail, "更早发布的公告必须排在同秒组之后");
    }

    @Test
    void archivedAnnouncementDisappearsFromPublicListAndItsOldUrlBecomesAnHonest404() throws Exception {
        String adminToken = adminToken();
        String id = insertPublished(adminToken, "SORTTEST-arch", "2026-01-02 03:04:05");

        mockMvc.perform(get("/api/v1/announcements/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));

        mockMvc.perform(patch("/api/v1/admin/operations/announcements/" + id)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isOk());

        assertTrue(!publicIds(adminToken).contains(id), "归档后不得出现在公开列表");

        // 旧 URL 变成诚实的 404 problem+json，而不是残留内容。
        mockMvc.perform(get("/api/v1/announcements/" + id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    /**
     * 结构性守卫：mapper 的公开列表查询**必须**带稳定 tie-breaker。
     *
     * <p>为什么需要它：下面的行为测试（重复读取同序）在 MySQL 上**证明不了** tie-breaker 的存在 ——
     * 实测把 `id DESC` 去掉后 5 条同秒数据仍然碰巧按同一顺序返回，测试照样通过。
     * 也就是说行为断言只能覆盖"当前实现没有明显抖动"，覆盖不了"以后有人删掉 tie-breaker"。
     * 这条测试直接读注解里的 SQL 文本，删掉 `id DESC` 就会红。
     *
     * <p>（这不是重复劳动：一条守行为、一条守契约，缺一条就有回归窗口。）
     */
    @Test
    void publicListQueryKeepsAStableTieBreaker() throws Exception {
        Select select = AnnouncementMapper.class
                .getMethod("listPublished", int.class)
                .getAnnotation(Select.class);
        assertNotNull(select, "listPublished 应继续用 @Select 注解声明 SQL");
        String sql = String.join(" ", select.value()).replaceAll("\\s+", " ");
        assertTrue(sql.contains("ORDER BY published_at DESC, id DESC"),
                "公开列表必须按 published_at DESC 后再用 id DESC 定序，当前 SQL: " + sql);
    }

    /**
     * 走正式 admin 创建路径，然后**直接把 published_at 改到目标秒**。
     * 之所以要回写：正常创建时 published_at = now()，两次调用很难落在同一秒，
     * 而本用例恰恰要构造"同秒"这一边界。
     */
    private String insertPublished(String adminToken, String title, String publishedAt) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/operations/announcements")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"" + title + "\",\"body\":\"正文 " + title + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"))
                .andReturn();
        String id = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("id").asText();
        jdbcTemplate.update("UPDATE announcement SET published_at = ? WHERE id = ?", publishedAt, id);
        return id;
    }

    private List<String> publicIds(String adminToken) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/announcements").param("limit", "50"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode array = objectMapper.readTree(result.getResponse().getContentAsString());
        List<String> ids = new ArrayList<>();
        array.forEach(node -> ids.add(node.path("id").asText()));
        return ids;
    }

    /** 保留 list 中属于 keep 的元素，保持 list 的原始顺序。 */
    private List<String> filterTo(List<String> list, List<String> keep) {
        List<String> out = new ArrayList<>();
        for (String id : list) {
            if (keep.contains(id)) out.add(id);
        }
        return out;
    }

    private int indexOfTitle(String adminToken, String title) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/announcements").param("limit", "50"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode array = objectMapper.readTree(result.getResponse().getContentAsString());
        for (int i = 0; i < array.size(); i++) {
            if (title.equals(array.get(i).path("title").asText())) {
                return i;
            }
        }
        return -1;
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
}
