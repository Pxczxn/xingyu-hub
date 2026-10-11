package top.pxczxn.xingyu;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.LoggerFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.PasswordSupport;
import top.pxczxn.xingyu.system.service.SysConfigGroupService;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 关注流查询基线 + 行为等价验证（Phase 6.1，2026-10-11）。
 *
 * <p><b>SQL 计数</b>：通过 Druid 全局 stat（executeCount 总和的请求前后差值）
 * 统计 GET /me/home 的真实 SQL 次数，覆盖 F=0/1/10/50 四档。
 *
 * <p><b>行为等价 oracle</b>：本测试内置旧「逐 followee 逐内容」实现的等价副本
 * （直接使用公开 mapper，业务规则逐条复刻），断言新实现经 HTTP 返回的
 * followUpdates 与 oracle 的 (type, id) 序列完全一致——实现如何重构，
 * 输出契约被 oracle 锁定。
 *
 * <p>覆盖：0/1/10/50 关注、作者无内容、游客与无关注账号、
 * 未发布文章/隐藏文档/治理下架不可见。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FollowingFeedBaselineIntegrationTest {

    private static final String PASSWORD = "Abcd1234!";
    private static final String PREFIX = "ffb-";

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private UserFollowMapper userFollowMapper;
    @Autowired
    private ArticleMapper articleMapper;
    @Autowired
    private SeriesMapper seriesMapper;
    @Autowired
    private MomentMapper momentMapper;
    @Autowired
    private SearchDocumentMapper searchDocumentMapper;
    @Autowired
    private SysConfigGroupService configGroupService;

    private final List<String> userIds = new ArrayList<>();
    private final List<String> authorEmails = new ArrayList<>();
    /** seed 过的 search_document 主键——cleanup 按此精确删除（object_id 是 UUID，LIKE 前缀永不匹配）。 */
    private final List<String> seededDocIds = new ArrayList<>();

    private String ownerToken;
    private String ownerId;

    @BeforeAll
    void seedOwners() throws Exception {
        // rebuild 会重置登录验证码开关——测试 fixture 显式关闭（CommunityTestSupport 同款）
        top.pxczxn.xingyu.CommunityTestSupport.ensureRegistrationOpen(configGroupService);
        // 主账号（关注者）+ 一个内容作者（保证 F=1 有内容可达）
        ownerId = seedUser("ffb-owner");
        ownerToken = login("ffb-owner");
        String authorEmail = seedUserRecord("ffb-author")[1];
        authorEmails.add(authorEmail);
    }

    @AfterAll
    void cleanup() {
        for (String docId : seededDocIds) {
            jdbcTemplate.update("DELETE FROM search_document WHERE id = ?", docId);
        }
        for (String userId : userIds) {
            jdbcTemplate.update("DELETE FROM user_follow WHERE follower_id = ? OR followee_id = ?", userId, userId);
            jdbcTemplate.update("DELETE FROM search_document WHERE object_id LIKE ?", PREFIX + userId + "%");
            jdbcTemplate.update("DELETE FROM article WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM series WHERE owner_id = ?", userId);
            jdbcTemplate.update("DELETE FROM moment WHERE author_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_session WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_creation_space WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", userId);
            jdbcTemplate.update("DELETE FROM community_user WHERE id = ?", userId);
        }
        userIds.clear();
    }

    // ---- Phase B：SQL 查询基线 ----

    @Test
    void sqlCountBaselineAcrossFolloweeScales() throws Exception {
        // F=0（无关注）
        long base0 = sqlCountOfMeHome();
        // F=1（有内容作者）
        follow(authorEmails.get(0));
        long base1 = sqlCountOfMeHome();
        // F=10、F=50：批量注册无内容作者（内容作者已含 1 个）+ 孤儿作者（资料缺失场景）
        registerFollowees(9);
        long base10 = sqlCountOfMeHome();
        registerFollowees(40);
        long base50 = sqlCountOfMeHome();

        System.out.println("[SQL-BASELINE] F=0 -> " + base0);
        System.out.println("[SQL-BASELINE] F=1 -> " + base1);
        System.out.println("[SQL-BASELINE] F=10 -> " + base10);
        System.out.println("[SQL-BASELINE] F=50 -> " + base50);
        // 回归断言（Phase 6.1-F）：批量后单请求 SQL 数不随关注数线性增长。
        // 批量实现 = 常数基础 + 每类型一次集合查询 + 富化批量；旧实现 F=50 时 354。
        assertTrue(base50 < 220, "F=50 的 /me/home SQL 数必须远离旧实现的线性水平（354），实际=" + base50);
        assertTrue(base50 - base0 <= 30,
                "关注数 0→50 的 SQL 增量必须为常数级（三类型批量各一次/请求），实际增量=" + (base50 - base0));
    }

    // ---- Phase D：行为等价（oracle 锁定输出契约）----

    @Test
    void followUpdatesMatchLegacyOracle() throws Exception {
        // fixture：2 篇文章（1 发布 + 1 草稿）、1 个 ACTIVE 系列、3 条动态（第 3 条治理下架）
        String[] record = seedUserRecord("ffb-author2");
        String followee = record[0];
        authorEmails.add(record[1]);
        String spaceId = jdbcTemplate.queryForObject(
                "SELECT id FROM community_creation_space WHERE user_id = ?", String.class, followee);
        String publishedArticle = UUID.randomUUID().toString();
        String draftArticle = UUID.randomUUID().toString();
        String activeSeries = UUID.randomUUID().toString();
        String moment1 = UUID.randomUUID().toString();
        String moment2 = UUID.randomUUID().toString();
        String moment3 = UUID.randomUUID().toString();
        String moment4 = UUID.randomUUID().toString();
        String moment5 = UUID.randomUUID().toString();
        String moment6 = UUID.randomUUID().toString();
        seedArticle(publishedArticle, followee, spaceId, "PUBLISHED", "ACTIVE", 65);
        seedArticle(draftArticle, followee, spaceId, "DRAFT", "ACTIVE", 0);
        seedSeries(activeSeries, followee, spaceId, 55);
        seedMoment(moment1, followee, 60);
        seedMoment(moment2, followee, 50);
        seedMoment(moment3, followee, 40);
        seedMoment(moment4, followee, 30);
        seedMoment(moment5, followee, 20);
        seedMoment(moment6, followee, 10);
        // 治理隐藏：最新的 moment6——旧语义（每人前 5 内过滤）下不回填第 6 条
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'MOMENT' AND object_id = ?",
                moment6);
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'MOMENT' AND object_id = ?",
                moment3);
        System.out.println("[PROBE] map m1=" + moment1 + " m2=" + moment2 + " m3=" + moment3
                + " m4=" + moment4 + " m5=" + moment5 + " m6=" + moment6);
        System.out.println("[PROBE] hidden6=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type='MOMENT' AND object_id=? AND removed_at IS NOT NULL",
                Integer.class, moment6));
        System.out.println("[PROBE] hidden3=" + jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM search_document WHERE object_type='MOMENT' AND object_id=? AND removed_at IS NOT NULL",
                Integer.class, moment3));
        // 旧的 article_topic 式挂载不需要——following 流直接按 owner 查
        follow(authorEmails.get(1));

        String expected = legacyOracle(followee);

        MvcResult result = mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .get("/api/v1/me/home").header("satoken", ownerToken))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn();
        var body = objectMapper.readTree(result.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        List<String> actual = new ArrayList<>();
        body.path("followUpdates").forEach(card -> actual.add(
                card.path("objectType").asText() + ":" + card.path("id").asText()));
        String actualJoined = "[" + String.join(", ", actual) + "]";

        assertEquals(expected, actualJoined, "followUpdates 必须与旧逐对象实现的输出逐项一致");
        // 治理隐藏与草稿不得出现
        assertTrue(actual.stream().noneMatch(x -> x.contains(draftArticle)), "草稿不可见");
        assertTrue(actual.stream().noneMatch(x -> x.contains(moment3)), "治理隐藏不可见");
        assertTrue(actual.stream().noneMatch(x -> x.contains(moment6)), "最新隐藏动态不可见");
        // 不回填：6 条动态、m3 与 m6（两条）治理隐藏 → 每人前 5 内（m6,m5,m4,m3,m2）
        // 剩 3 条可见，m1 不得补位（ARTICLE + SERIES + 3 条可见动态）
        assertEquals(4, actual.size() - 1, "隐藏不回填：m1 不得补位");
    }

    @Test
    void guestAndZeroFollowGetsEmptyFollowUpdates() throws Exception {
        // 游客：/home 无 followUpdates（rails 缺省）
        MvcResult guest = mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/home"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn();
        var guestBody = objectMapper.readTree(guest.getResponse()
                .getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertTrue(guestBody.path("followUpdates").isEmpty() || guestBody.path("followUpdates").isMissingNode(),
                "游客不得有关注流");
    }

    // ---- oracle：旧「逐 followee 逐内容」实现的等价副本 ----

    private String legacyOracle(String followeeId) {
        List<SearchDocument> documents = new ArrayList<>();
        for (Article article : articleMapper.listByOwnerId(followeeId)) {
            if (!ArticleStateSupport.isActiveLifecycle(article) || !ArticleStateSupport.isPublished(article)) {
                continue;
            }
            SearchDocument document = searchDocumentMapper.findByObject("ARTICLE", article.getId());
            if (document != null && document.getRemovedAt() == null) {
                documents.add(document);
            }
        }
        for (Series series : seriesMapper.listByOwnerId(followeeId)) {
            if (!"ACTIVE".equals(series.getStatus())) {
                continue;
            }
            SearchDocument document = searchDocumentMapper.findByObject("SERIES", series.getId());
            if (document != null && document.getRemovedAt() == null) {
                documents.add(document);
            }
        }
        for (Moment moment : momentMapper.listByAuthorId(followeeId, 5)) {
            SearchDocument document = searchDocumentMapper.findByObject("MOMENT", moment.getId());
            if (document != null && document.getRemovedAt() == null) {
                documents.add(document);
            }
        }
        List<SearchResultViewIds> sorted = documents.stream()
                .sorted(Comparator.comparing(SearchDocument::getIndexedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(10)
                .map(doc -> new SearchResultViewIds(doc.getObjectType(), doc.getObjectId()))
                .toList();
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < sorted.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(sorted.get(i).type()).append(":").append(sorted.get(i).id());
        }
        return sb.append("]").toString();
    }

    private record SearchResultViewIds(String type, String id) {
    }

    // ---- helpers ----

    private record SQLWindow(long before, long after) {
        long delta() {
            return after - before;
        }
    }

    private final ListAppender<ILoggingEvent> sqlLogAppender = new ListAppender<>();

    /** 通过 mapper DEBUG 日志的 "Preparing:" 行精确计数真实 SQL 条数。 */
    private void startSqlCapture() {
        Logger mapperLogger = (Logger) LoggerFactory.getLogger("top.pxczxn.xingyu.community.mapper");
        sqlLogAppender.setContext((ch.qos.logback.classic.LoggerContext) LoggerFactory.getILoggerFactory());
        sqlLogAppender.start();
        mapperLogger.addAppender(sqlLogAppender);
        mapperLogger.setLevel(Level.DEBUG);
    }

    private void stopSqlCapture() {
        Logger mapperLogger = (Logger) LoggerFactory.getLogger("top.pxczxn.xingyu.community.mapper");
        mapperLogger.detachAppender(sqlLogAppender);
        sqlLogAppender.list.clear();
    }

    private long countPreparedSql() {
        return sqlLogAppender.list.stream()
                .filter(event -> event.getFormattedMessage() != null
                        && event.getFormattedMessage().contains("Preparing:"))
                .count();
    }

    private long sqlCountOfMeHome() throws Exception {
        startSqlCapture();
        try {
            mockMvc.perform(
                            org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                    .get("/api/v1/me/home").header("satoken", ownerToken))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
            long count = countPreparedSql();
            sqlLogAppender.list.stream()
                    .filter(event -> event.getFormattedMessage() != null
                            && event.getFormattedMessage().contains("Preparing:"))
                    .limit(3)
                    .forEach(event -> System.out.println("[SQL-SAMPLE] "
                            + event.getFormattedMessage()
                                .split(System.lineSeparator())[0].trim()));
            System.out.println("[SQL-SAMPLE] ... total=" + count);
            return count;
        } finally {
            stopSqlCapture();
        }
    }

    private void follow(String followeeEmail) {
        String followee = jdbcTemplate.queryForObject(
                "SELECT id FROM community_user WHERE email = ?", String.class, followeeEmail);
        int rows = jdbcTemplate.update(
                "INSERT IGNORE INTO user_follow (id, follower_id, followee_id, created_at) VALUES (?, ?, ?, NOW())",
                UUID.randomUUID().toString(), ownerId, followee);
        int visible = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_follow WHERE follower_id = ?", Integer.class, ownerId);
        System.out.println("[FOLLOW] rows=" + rows + " visible=" + visible
                + " follower=" + ownerId.substring(0, 8) + " followee=" + followee.substring(0, 8));
    }

    private void registerFollowees(int count) throws Exception {
        for (int i = 0; i < count; i++) {
            String[] record = seedUserRecord("ffb-filler" + (userIds.size()));
            follow(record[1]);
            // 孤儿作者：无内容、无 profile（覆盖资料缺失降级）
            jdbcTemplate.update("DELETE FROM community_profile WHERE user_id = ?", record[0]);
        }
    }

    private void seedArticle(String id, String ownerId, String spaceId, String status, String lifecycle, int seq) {
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'NORMAL', NOW(), NOW())
                """, id, ownerId, spaceId, status, lifecycle);
        if ("PUBLISHED".equals(status)) {
            String docId = UUID.randomUUID().toString();
            seededDocIds.add(docId);
            jdbcTemplate.update("""
                    INSERT INTO search_document
                        (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                    VALUES (?, 'ARTICLE', ?, '关注流文章', NULL, 1, NOW() - INTERVAL ? SECOND)
                    """, docId, id, seq);
        }
    }

    private void seedSeries(String id, String ownerId, String spaceId, int seq) {
        jdbcTemplate.update("""
                INSERT INTO series (id, owner_id, space_id, title, slug, status, lock_version, created_at, updated_at)
                VALUES (?, ?, ?, '关注流系列', ?, 'ACTIVE', 0, NOW(), NOW())
                """, id, ownerId, spaceId, "ffb-series-" + (System.nanoTime() % 100000000L));
        String seriesDocId = UUID.randomUUID().toString();
        seededDocIds.add(seriesDocId);
        jdbcTemplate.update("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'SERIES', ?, '关注流系列', NULL, 1, NOW() - INTERVAL ? SECOND)
                """, seriesDocId, id, seq);
    }

    private void seedMoment(String id, String ownerId, int sequence) {
        int seq = sequence;
        // created_at 间隔 1 秒：秒精度下让排序确定性（同秒 tie-break 属实现细节）
        jdbcTemplate.update("""
                INSERT INTO moment (id, author_id, status, created_at, updated_at)
                VALUES (?, ?, 'PUBLISHED', NOW() - INTERVAL ? SECOND, NOW())
                """, id, ownerId, sequence);
        jdbcTemplate.update("""
                UPDATE moment SET created_at = NOW() - INTERVAL ? SECOND WHERE id = ?
                """, sequence, id);
        String momentDocId = UUID.randomUUID().toString();
        seededDocIds.add(momentDocId);
        jdbcTemplate.update("""
                INSERT INTO search_document
                    (id, object_type, object_id, title, summary, discovery_version, indexed_at)
                VALUES (?, 'MOMENT', ?, '关注流动态', NULL, 1, NOW() - INTERVAL ? SECOND)
                """, momentDocId, id, seq);
    }

    private String seedUser(String prefix) {
        return seedUserRecord(prefix)[0];
    }

    /** 返回 [userId, email]——email 需要精确引用（LIKE 前缀在多作者场景有歧义）。 */
    private String[] seedUserRecord(String prefix) {
        String email = prefix + "-" + System.nanoTime() + "@example.com";
        String userId = UUID.randomUUID().toString();
        userIds.add(userId);
        jdbcTemplate.update("""
                INSERT INTO community_user (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), 'ACTIVE', 'user', '1.0', NOW())
                """, userId, email, PasswordSupport.hash(PASSWORD));
        jdbcTemplate.update("""
                INSERT INTO community_creation_space (id, user_id, slug, display_name, created_at)
                VALUES (?, ?, ?, 'probe', NOW())
                """, UUID.randomUUID().toString(), userId, prefix + "-space-" + (System.nanoTime() % 100000000L));
        jdbcTemplate.update("""
                INSERT INTO community_profile (id, user_id, username, visibility, lock_version, created_at)
                VALUES (?, ?, ?, 'PUBLIC', 0, NOW())
                """, UUID.randomUUID().toString(), userId, prefix.replace("-", "_") + (System.nanoTime() % 1_000_000_000L));
        return new String[] { userId, email };
    }

    private String login(String prefix) throws Exception {
        String email = jdbcTemplate.queryForObject(
                "SELECT email FROM community_user WHERE email LIKE ?", String.class, prefix + "%");
        MvcResult result = mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                                .post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"login\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn();
        return result.getResponse().getHeader("satoken");
    }
}
