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

import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 星系内容推荐契约回归（Galaxy Content Contribution，V054，2026-10-22）。
 *
 * <p>钉死的边界：
 * <ul>
 *   <li>只有星系成员能推荐；非成员 403。</li>
 *   <li>只能推荐本人已公开发布的文章：未发布（无 published_revision）409、他人作品 404。</li>
 *   <li>重复提交幂等——返回同一条 PENDING，不堆记录。</li>
 *   <li>审核通过才写入 galaxy_content 并在公开内容区可见；重复通过 409。</li>
 *   <li>拒绝必须给理由；拒绝后内容不出现。</li>
 *   <li>已下架（search_document.removed_at 非空）的内容不得借推荐入口重新上架。</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class GalaxyContentContributionIntegrationTest {

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
    private final List<String> articleIds = new ArrayList<>();

    private String memberToken;
    private String memberId;
    private String outsiderToken;
    private String galaxySlug;
    private String galaxyId;

    /** 已发布 + 已入索引的四篇文章，各自服务一个用例，互不干扰。 */
    private String articleForApprove;
    private String articleForReject;
    private String articleForDuplicate;
    private String articleForDelist;
    /** 本人未发布（无 published_revision）的文章。 */
    private String articleUnpublished;
    /** 他人已发布文章。 */
    private String articleOfOtherAuthor;

    @BeforeAll
    void setUp() throws Exception {
        CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        long nonce = System.nanoTime();
        memberToken = seedUserAndLogin(
                "gcc-member-" + nonce, "gcc-member-space-" + (nonce % 1_000_000_000L));
        memberId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email = ?", String.class, "gcc-member-" + nonce + "@example.com");
        outsiderToken = seedUserAndLogin(
                "gcc-outsider-" + nonce, "gcc-outsider-space-" + (nonce % 1_000_000_000L));
        String otherAuthorId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email = ?", String.class, "gcc-outsider-" + nonce + "@example.com");

        galaxyId = UUID.randomUUID().toString();
        galaxySlug = "gcc-" + (nonce % 100000000L);
        jdbcTemplate.update("""
                INSERT INTO galaxy (id, seed_key, slug, name, official, join_mode)
                VALUES (?, ?, ?, ?, 1, 'OPEN')
                """, galaxyId, "gcc-seed", galaxySlug, "内容推荐回归星系");

        articleForApprove = seedPublishedArticle(memberId, "待通过推荐的作品");
        articleForReject = seedPublishedArticle(memberId, "待拒绝推荐的作品");
        articleForDuplicate = seedPublishedArticle(memberId, "重复提交的作品");
        articleForDelist = seedPublishedArticle(memberId, "将被下架的作品");
        articleUnpublished = seedUnpublishedArticle(memberId, "还没发布的作品");
        articleOfOtherAuthor = seedPublishedArticle(otherAuthorId, "他人的作品");
    }

    @AfterAll
    void tearDown() {
        jdbcTemplate.update("DELETE FROM galaxy_content_submission WHERE galaxy_id = ?", galaxyId);
        jdbcTemplate.update("DELETE FROM galaxy_content WHERE galaxy_id = ?", galaxyId);
        for (String articleId : articleIds) {
            jdbcTemplate.update("DELETE FROM search_document WHERE object_type = 'ARTICLE' AND object_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM published_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM formal_revision WHERE article_id = ?", articleId);
            jdbcTemplate.update("DELETE FROM article WHERE id = ?", articleId);
        }
        jdbcTemplate.update("DELETE FROM galaxy_member WHERE galaxy_id = ?", galaxyId);
        jdbcTemplate.update("DELETE FROM galaxy WHERE id = ?", galaxyId);
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
        articleIds.clear();
    }

    // ---- criterion-1 / criterion-3：成员提交 ----

    @Test
    @Order(1)
    void nonMemberCannotSubmitContent() throws Exception {
        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", outsiderToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleForApprove + "\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("AUTH_FORBIDDEN"));

        // 加入后同一请求才有意义：这里顺带把 member 变成成员
        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/join").header("satoken", memberToken))
                .andExpect(status().isOk());
    }

    @Test
    @Order(2)
    void unpublishedAndForeignArticlesAreRejected() throws Exception {
        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleUnpublished + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"));

        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleOfOtherAuthor + "\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"SERIES\",\"objectId\":\"" + articleForApprove + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    @Order(3)
    void duplicateSubmissionReturnsTheSamePendingRecord() throws Exception {
        String first = submitContent(memberToken, articleForDuplicate, "第一次推荐");
        String second = submitContent(memberToken, articleForDuplicate, "重复推荐");
        assertEquals(first, second, "重复提交必须返回同一条待审申请");
        Integer pending = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM galaxy_content_submission
                WHERE galaxy_id = ? AND object_id = ? AND status = 'PENDING'
                """, Integer.class, galaxyId, articleForDuplicate);
        assertEquals(1, pending);
    }

    // ---- criterion-2：审核通过后进入星系内容 ----

    @Test
    @Order(4)
    void approvalPublishesContentIntoTheGalaxy() throws Exception {
        String submissionId = submitContent(memberToken, articleForApprove, "推荐理由");
        String adminToken = adminLogin();

        mockMvc.perform(get("/api/v1/admin/community/galaxies/" + galaxyId + "/content-submissions")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                // 先提交的作品排在前（created_at ASC），用集合断言避免依赖其它用例
                .andExpect(jsonPath("$.data[*].id", hasItem(submissionId)))
                .andExpect(jsonPath("$.data[?(@.id == '" + submissionId + "')].status").value("PENDING"))
                .andExpect(jsonPath("$.data[?(@.id == '" + submissionId + "')].title")
                        .value("待通过推荐的作品"));

        mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/approve")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        // 公开内容区出现该作品（内容行 + 活文档）
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].objectId").value(articleForApprove))
                .andExpect(jsonPath("$[0].title").value("待通过推荐的作品"));

        // 推荐人能看到自己的记录已通过（同一成员可能有多条推荐记录）
        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content-submissions/mine")
                        .header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem(submissionId)))
                .andExpect(jsonPath("$[?(@.id == '" + submissionId + "')].status", hasItem("APPROVED")));

        // 重复通过返回业务冲突，且不产生第二条内容行
        mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/approve")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409));
        Integer rows = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM galaxy_content WHERE galaxy_id = ? AND object_id = ?",
                Integer.class, galaxyId, articleForApprove);
        assertEquals(1, rows);

        // 已上架的作品不能再次推荐
        mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleForApprove + "\"}"))
                .andExpect(status().isConflict());
    }

    // ---- criterion-4：拒绝、失败恢复 ----

    @Test
    @Order(5)
    void rejectionRequiresReasonAndKeepsContentOut() throws Exception {
        String submissionId = submitContent(memberToken, articleForReject, null);
        String adminToken = adminLogin();

        mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/reject")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"   \"}"))
                // 管理端契约：业务失败以 HTTP 200 + body.code 表达
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(400));

        mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/reject")
                        .header("satoken", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"与星系主题不符\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content-submissions/mine")
                        .header("satoken", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("REJECTED"))
                .andExpect(jsonPath("$[0].rejectReason").value("与星系主题不符"));

        // 被拒绝的作品没有进入内容区
        String body = mockMvc.perform(get("/api/v1/galaxies/" + galaxySlug + "/content"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(!body.contains(articleForReject), "被拒绝的推荐不得出现在星系内容区");

        // 处理过的推荐不能再被通过
        mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/approve")
                        .header("satoken", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(409));
    }

    @Test
    @Order(6)
    void delistedContentCannotBeApprovedIntoTheGalaxy() throws Exception {
        String submissionId = submitContent(memberToken, articleForDelist, "刚发布就推荐");
        String adminToken = adminLogin();
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'ARTICLE' AND object_id = ?",
                articleForDelist);
        try {
            mockMvc.perform(post("/api/v1/admin/community/galaxies/content-submissions/" + submissionId + "/approve")
                            .header("satoken", adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code").value(409));
        } finally {
            jdbcTemplate.update(
                    "UPDATE search_document SET removed_at = NULL WHERE object_type = 'ARTICLE' AND object_id = ?",
                    articleForDelist);
        }
        Integer rows = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM galaxy_content_submission WHERE id = ? AND status = 'PENDING'
                """, Integer.class, submissionId);
        assertEquals(1, rows, "上架失败时推荐必须保持 PENDING，不能悄悄变成已通过");
    }

    // ---- helpers ----

    private String submitContent(String token, String articleId, String note) throws Exception {
        String payload = note == null
                ? "{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\"}"
                : "{\"objectType\":\"ARTICLE\",\"objectId\":\"" + articleId + "\",\"note\":\"" + note + "\"}";
        MvcResult result = mockMvc.perform(post("/api/v1/galaxies/" + galaxySlug + "/content-submissions")
                        .header("satoken", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        String id = objectMapper.readTree(result.getResponse().getContentAsString()).path("id").asText();
        assertNotEquals("", id, "提交必须返回推荐 id");
        return id;
    }

    /** 造一篇"已公开发布 + 已入索引"的文章，满足 ArticleAccessService 的全部条件。 */
    private String seedPublishedArticle(String ownerId, String title) {
        String articleId = seedArticle(ownerId, "PUBLISHED", "ACTIVE", "NORMAL");
        String revisionId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO formal_revision
                    (id, article_id, revision_number, title, summary, body_mode, body, visibility,
                     source_draft_lock_version, frozen_at, created_at)
                VALUES (?, ?, 1, ?, ?, 'MARKDOWN', '正文', 'PUBLIC', 0, NOW(), NOW())
                """, revisionId, articleId, title, title + "的摘要");
        jdbcTemplate.update("""
                INSERT INTO published_revision (id, article_id, formal_revision_id, published_at, publication_event_id)
                VALUES (?, ?, ?, NOW(), ?)
                """, UUID.randomUUID().toString(), articleId, revisionId, UUID.randomUUID().toString());
        jdbcTemplate.update("""
                INSERT INTO search_document (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'ARTICLE', ?, ?, ?, 1, NOW())
                """, UUID.randomUUID().toString(), articleId, title, title + "的摘要");
        return articleId;
    }

    private String seedUnpublishedArticle(String ownerId, String title) {
        return seedArticle(ownerId, "DRAFT", "ACTIVE", "NORMAL");
    }

    private String seedArticle(String ownerId, String status, String lifecycle, String moderation) {
        String articleId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                SELECT ?, ?, cs.id, ?, ?, ?, NOW(), NOW()
                FROM community_creation_space cs WHERE cs.user_id = ?
                """, articleId, ownerId, status, lifecycle, moderation, ownerId);
        articleIds.add(articleId);
        return articleId;
    }

    private String seedUserAndLogin(String prefix, String spaceSlug) throws Exception {
        String email = prefix + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user
                    (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'gcc-space', NOW())
                """, UUID.randomUUID().toString(), userId, spaceSlug);
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId, prefix.replace("-", "_"));
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String token = login.getResponse().getHeader("satoken");
        assertNotEquals(null, token, "登录必须返回 satoken");
        return token;
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
}
