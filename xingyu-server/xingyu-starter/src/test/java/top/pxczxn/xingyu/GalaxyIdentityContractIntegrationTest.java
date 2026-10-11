package top.pxczxn.xingyu;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Galaxy Identity & Content Contract 回归（2026-10-10 Phase 4.2）。
 *
 * <p>钉死：GalaxyView 三区分契约（joinMode 公共、joined viewer 三态且仅详情端点、
 * contentCount 详情专属）、ContentSummary 形状（ARTICLE/SERIES/MOMENT 富字段）、
 * 治理隐藏内容下架联动（removed_at 过滤）、无作者 profile 的容错。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GalaxyIdentityContractIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> galaxyIds = new ArrayList<>();
    private final List<String> contentRowIds = new ArrayList<>();
    private final List<String> objectRowIds = new ArrayList<>();

    private String token;      // 普通用户（先未加入后加入）
    private String galaxySlug;
    private String galaxyId;
    private String authorId;   // 挂载内容的作者

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        token = seedUser("gicc-user");
        authorId = seedUserRecord("gicc-author").get(0);
        galaxyId = UUID.randomUUID().toString();
        galaxySlug = "gicc-" + (System.nanoTime() % 100000000L);
        jdbcTemplate.update("""
                INSERT INTO galaxy (id, seed_key, slug, name, official, join_mode)
                VALUES (?, ?, ?, ?, 1, 'OPEN')
                """, galaxyId, "gicc-seed", galaxySlug, "身份契约回归星系");
        galaxyIds.add(galaxyId);
        seedObjectsAndIndex();
    }

    @AfterAll
    void tearDown() {
        for (String rowId : contentRowIds) {
            jdbcTemplate.update("DELETE FROM galaxy_content WHERE id = ?", rowId);
        }
        for (String oid : objectRowIds) {
            jdbcTemplate.update("DELETE FROM search_document WHERE object_id = ?", oid);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", oid);
            jdbcTemplate.update("DELETE FROM series WHERE id = ?", oid);
            jdbcTemplate.update("DELETE FROM moment WHERE id = ?", oid);
        }
        for (String gid : galaxyIds) {
            jdbcTemplate.update("DELETE FROM galaxy_member WHERE galaxy_id = ?", gid);
            jdbcTemplate.update("DELETE FROM galaxy WHERE id = ?", gid);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        galaxyIds.clear();
        contentRowIds.clear();
        objectRowIds.clear();
    }

    // ---- Step 2 验收：GalaxyView 契约 ----

    @Test
    @Order(1)
    void guestGetsNullJoinedAndPublicFields() throws Exception {
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joinMode").value("OPEN"))
                // 游客「未知」必须表达为字段缺省（null），不得渲染成 false
                .andExpect(jsonPath("$.joined").doesNotExist())
                .andExpect(jsonPath("$.contentCount").value(3)) // setUp 已挂 ARTICLE/SERIES/MOMENT 三行
                // V051 未执行：identity 字段契约先行，恒为 null
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.coverUrl").doesNotExist());
    }

    @Test
    @Order(2)
    void signedInNonMemberGetsFalse() throws Exception {
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug).header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joined").value(false));
    }

    @Test
    @Order(3)
    void memberGetsTrueAndListEndpointNeverCarriesJoined() throws Exception {
        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/join").header("satoken", token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug).header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.joined").value(true));

        // 列表端点不做逐行 viewer 查询（N+1 风险）：joined 恒缺省
        MvcResult list = mockMvc.perform(get("/api/v1/galaxies").header("satoken", token))
                .andExpect(status().isOk())
                .andReturn();
        var array = objectMapper.readTree(list.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        array.forEach(item -> assertEquals(false, item.hasNonNull("joined"),
                "列表端点不得携带 viewer 状态"));
        // 列表仍暴露公共 joinMode
        array.forEach(item -> assertEquals("OPEN", item.path("joinMode").asText()));
    }

    // ---- Step 3 验收：ContentSummary 契约 ----

    @Test
    @Order(4)
    void contentSummaryCoversArticleSeriesMoment() throws Exception {
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                // ARTICLE：富字段齐备
                .andExpect(jsonPath("$[?(@.objectType=='ARTICLE')].summary").isNotEmpty())
                .andExpect(jsonPath("$[?(@.objectType=='ARTICLE')].authorName").isNotEmpty()) // profile username（enrich 容错见 Order 6）
                // SERIES / MOMENT：title/summary/updatedAt 来自活文档
                .andExpect(jsonPath("$[?(@.objectType=='SERIES')].title").isNotEmpty())
                .andExpect(jsonPath("$[?(@.objectType=='MOMENT')].title").isNotEmpty())
                // pinned 置顶排序：pinned 行在前
                .andExpect(jsonPath("$[0].pinned").value(true));
    }

    @Test
    @Order(5)
    void moderatedContentDisappearsFromGalaxy() throws Exception {
        // 治理隐藏：search_document.removed_at 置位 → 星系内容联动消失
        Integer before = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_content WHERE galaxy_id = ?", Integer.class, galaxyId);
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'ARTICLE' AND object_id = ?",
                objectRowIds.get(0));
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.objectType=='ARTICLE')]").isEmpty());
        // contentCount 必须与可见性一致：隐藏内容不计入公开计数
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentCount").value(before - 1));
        Integer after = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_content WHERE galaxy_id = ?", Integer.class, galaxyId);
        assertEquals(before, after, "挂载行不删除——过滤发生在读取契约，恢复 removed_at 即恢复展示");
        // 恢复后重新可见
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NULL WHERE object_type = 'ARTICLE' AND object_id = ?",
                objectRowIds.get(0));
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.objectType=='ARTICLE')].summary").isNotEmpty());
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contentCount").value(before.intValue()));
    }

    @Test
    @Order(6)
    void missingAuthorProfileTolerated() throws Exception {
        // 无 profile 的作者：authorName 为 null（jqpath 表达为 [null]），整行照常渲染
        jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", authorId);
        MvcResult result = mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                .andReturn();
        var array = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        var articleAuthorNames = new java.util.ArrayList<String>();
        array.forEach(item -> {
            if ("ARTICLE".equals(item.path("objectType").asText())) {
                articleAuthorNames.add(item.path("authorName").isNull() ? null : item.path("authorName").asText());
            }
        });
        assertEquals(1, articleAuthorNames.size(), "ARTICLE 行必须仍渲染");
        assertEquals(null, articleAuthorNames.get(0), "profile 缺失时 authorName 必须为 null 而非异常");
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, 'gicc-author-restored', 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), authorId);
    }

    @Test
    @Order(7)
    void adminIdentityFieldsRoundTripAndValidation() throws Exception {
        String adminToken = adminLogin();
        // 写入 → 详情回读（V051 已由 SchemaMigrator 在 test 库执行）
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"契约星系简介\",\"coverUrl\":\"/covers/gicc.webp\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug).header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("契约星系简介"))
                .andExpect(jsonPath("$.coverUrl").value("/covers/gicc.webp"));
        // 服务端校验：超长 512 拒绝（不截断）
        String tooLong = "x".repeat(513);
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"" + tooLong + "\"}"))
                // 管理端错误为 HTTP 200 + envelope code（治理域惯例）
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));
        // 显式 null = 清空
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":null,\"coverUrl\":null}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug).header("satoken", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.coverUrl").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    @Order(8)
    void partialUpdateKeepsUnmentionedIdentityFields() throws Exception {
        // Phase A 收口：全字段显式 UPDATE 不得意外清空未修改字段——
        // 先写入 description，再只 PATCH name，description 必须原样保留。
        String adminToken = adminLogin();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"保留我\",\"coverUrl\":\"/covers/keep.webp\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/" + galaxyId)
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"部分更新回归星系\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("部分更新回归星系"))
                .andExpect(jsonPath("$.description").value("保留我"))
                .andExpect(jsonPath("$.coverUrl").value("/covers/keep.webp"));
    }

    @Test
    @Order(9)
    void unknownGalaxyUpdateIsNotFound() throws Exception {
        // ContractException NOT_FOUND 在 admin 域必须落到结构化 404（补齐前为 500）
        String adminToken = adminLogin();
        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .patch("/api/v1/admin/community/galaxies/nonexistent-id")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(404));
    }

    @Test
    @Order(10)
    void moderatedContentCannotBeReMountedViaCuration() throws Exception {
        // Phase C 收口：被治理下架的内容不得通过策展入口重新公开（入口拒绝）
        String adminToken = adminLogin();
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'ARTICLE' AND object_id = ?",
                objectRowIds.get(0));
        try {
            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                            .post("/api/v1/admin/community/galaxies/" + galaxyId + "/content")
                            .header("satoken", adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + objectRowIds.get(0)
                                    + "\",\"pinned\":false}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(404));
        } finally {
            // 恢复 ARTICLE 供其它用例/断言稳定
            jdbcTemplate.update(
                    "UPDATE search_document SET removed_at = NULL WHERE object_type = 'ARTICLE' AND object_id = ?",
                    objectRowIds.get(0));
        }
    }

    private String adminLogin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin123\",\"clientType\":\"ADMIN\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("token").asText();
    }

    // ---- helpers ----

    /** 为挂载契约造三类型对象 + search_document 活文档 + galaxy_content 行。 */
    private void seedObjectsAndIndex() {
        long nonce = System.nanoTime() % 100000000L;

        // ARTICLE（owner=作者，enrich 通过 profile 出 authorName；title 在 search_document）
        String articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                SELECT ?, ?, cs.id, 'PUBLISHED', 'PUBLISHED', 'NORMAL', NOW(), NOW()
                FROM community_creation_space cs WHERE cs.user_id = ?
                """, articleId, authorId, authorId);
        objectRowIds.add(articleId);

        // SERIES
        String seriesId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO series (id, owner_id, space_id, title, slug, status, lock_version, created_at, updated_at)
                SELECT ?, ?, cs.id, '契约系列', ?, 'ACTIVE', 0, NOW(), NOW()
                FROM community_creation_space cs WHERE cs.user_id = ?
                """, seriesId, authorId, "gicc-ser-" + nonce, authorId);
        objectRowIds.add(seriesId);

        // MOMENT
        String momentId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO moment (id, author_id, status, created_at, updated_at)
                VALUES (?, ?, 'PUBLISHED', NOW(), NOW())
                """, momentId, authorId);
        objectRowIds.add(momentId);

        // 活文档（含 summary；一条 ARTICLE 文档后续用于下架联动）
        for (Object[] spec : new Object[][]{
                {"ARTICLE", articleId, "契约文章标题", "契约文章摘要内容"},
                {"SERIES", seriesId, "契约系列标题", "契约系列摘要内容"},
                {"MOMENT", momentId, "契约动态标题", null}}) {
            jdbcTemplate.update("""
                    INSERT INTO search_document
                        (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                    VALUES (?, ?, ?, ?, ?, 1, NOW())
                    """, UUID.randomUUID().toString(), spec[0], spec[1], spec[2], spec[3]);
        }

        // 挂载：pinned ARTICLE + SERIES + MOMENT
        contentRowIds.add(seedContent(galaxyId, "ARTICLE", articleId, true));
        contentRowIds.add(seedContent(galaxyId, "SERIES", seriesId, false));
        contentRowIds.add(seedContent(galaxyId, "MOMENT", momentId, false));
    }

    private String seedContent(String gid, String type, String objectId, boolean pinned) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO galaxy_content (id, galaxy_id, object_type, object_id, pinned, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                """, id, gid, type, objectId, pinned);
        return id;
    }

    /** 返回 [userId, email]；seedUser 据此登录，避免两次生成 email 不一致。 */
    private List<String> seedUserRecord(String prefix) {
        String email = prefix + "-" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space
                    (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe-space', NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + "-space-" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update("""
                INSERT INTO community_profile
                    (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId,
                prefix + (System.nanoTime() % 1_000_000_000L));
        return List.of(userId, email);
    }

    private String seedUser(String prefix) throws Exception {
        List<String> record = seedUserRecord(prefix);
        String email = record.get(1);
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return login.getResponse().getHeader("satoken");
    }
}
