package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.service.SearchService;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 用户热度搜索：只对本次候选用户聚合 user_follow，零关注保留，顺序与全表 GROUP BY 一致。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class UserHotSearchIntegrationTest {

    private static final String HASH = "$2a$10$7EqJtq98hPqEX7fNZaYBlOYlK4r7u3l0mQv0yZ1pOa8dS5kYh2a2e";

    static final String LEGACY_SQL = """
            SELECT cp.username FROM community_profile cp
            INNER JOIN community_user cu ON cu.id = cp.user_id
            LEFT JOIN (
              SELECT followee_id, COUNT(*) AS follower_count
              FROM user_follow
              GROUP BY followee_id
            ) fc ON fc.followee_id = cp.user_id
            WHERE cu.status = 'ACTIVE'
              AND (
                LOWER(cp.username) LIKE CONCAT('%', LOWER(?), '%')
                OR LOWER(COALESCE(cp.display_name, '')) LIKE CONCAT('%', LOWER(?), '%')
                OR EXISTS (
                  SELECT 1 FROM username_history uh
                  WHERE uh.user_id = cp.user_id
                    AND LOWER(uh.username) LIKE CONCAT('%', LOWER(?), '%')
                )
              )
              AND (
                cp.visibility = 'PUBLIC'
                OR (
                  cp.visibility = 'UNLISTED'
                  AND (
                    LOWER(cp.username) = LOWER(TRIM(?))
                    OR EXISTS (
                      SELECT 1 FROM username_history uh2
                      WHERE uh2.user_id = cp.user_id
                        AND LOWER(uh2.username) = LOWER(TRIM(?))
                    )
                  )
                )
              )
            ORDER BY
              CASE WHEN LOWER(cp.username) = LOWER(TRIM(?)) THEN 0 ELSE 1 END,
              COALESCE(fc.follower_count, 0) DESC,
              cp.created_at DESC
            LIMIT ?
            """;

    static final String HOT_SQL = """
            WITH candidates AS (
              SELECT cp.* FROM community_profile cp
              INNER JOIN community_user cu ON cu.id = cp.user_id
              WHERE cu.status = 'ACTIVE'
                AND (
                  LOWER(cp.username) LIKE CONCAT('%', LOWER(?), '%')
                  OR LOWER(COALESCE(cp.display_name, '')) LIKE CONCAT('%', LOWER(?), '%')
                  OR EXISTS (
                    SELECT 1 FROM username_history uh
                    WHERE uh.user_id = cp.user_id
                      AND LOWER(uh.username) LIKE CONCAT('%', LOWER(?), '%')
                  )
                )
                AND (
                  cp.visibility = 'PUBLIC'
                  OR (
                    cp.visibility = 'UNLISTED'
                    AND (
                      LOWER(cp.username) = LOWER(TRIM(?))
                      OR EXISTS (
                        SELECT 1 FROM username_history uh2
                        WHERE uh2.user_id = cp.user_id
                          AND LOWER(uh2.username) = LOWER(TRIM(?))
                      )
                    )
                  )
                )
            )
            SELECT c.username FROM candidates c
            LEFT JOIN (
              SELECT uf.followee_id, COUNT(*) AS follower_count
              FROM user_follow uf
              INNER JOIN candidates cand ON cand.user_id = uf.followee_id
              GROUP BY uf.followee_id
            ) fc ON fc.followee_id = c.user_id
            ORDER BY
              CASE WHEN LOWER(c.username) = LOWER(TRIM(?)) THEN 0 ELSE 1 END,
              COALESCE(fc.follower_count, 0) DESC,
              c.created_at DESC
            LIMIT ?
            """;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private CommunityProfileMapper profileMapper;

    @Autowired
    private SearchService searchService;

    @Test
    void ranksByFollowersThenCreatedAtAndKeepsZeroFollow() {
        String tag = tag();
        Instant t2 = Instant.parse("2026-11-21T12:00:02Z");
        Instant t1 = Instant.parse("2026-11-21T12:00:01Z");
        Instant t0 = Instant.parse("2026-11-21T12:00:00Z");
        String high = insertUser(tag + "high", "PUBLIC", "ACTIVE", null, t0);
        String midNew = insertUser(tag + "midn", "PUBLIC", "ACTIVE", null, t2);
        String midOld = insertUser(tag + "mido", "PUBLIC", "ACTIVE", null, t1);
        String zero = insertUser(tag + "zero", "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T13:00:00Z"));
        follow(high, 3);
        follow(midNew, 1);
        follow(midOld, 1);

        List<String> names = usernames(profileMapper.searchDiscoverableByHot(tag, 10));
        assertEquals(List.of(tag + "high", tag + "midn", tag + "mido", tag + "zero"), names);
        assertEquals(names, jdbcUsernames(LEGACY_SQL, tag, 10));
        assertEquals(names, jdbcUsernames(HOT_SQL, tag, 10));
    }

    @Test
    void exactUsernameOutranksHigherFollowers() {
        String tag = tag();
        String exact = tag + "ex";
        insertUser(tag + "pop", "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T10:00:00Z"));
        insertUser(exact, "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T09:00:00Z"));
        follow(userId(tag + "pop"), 5);

        List<String> names = usernames(profileMapper.searchDiscoverableByHot(exact, 5));
        assertEquals(exact, names.get(0));
        assertEquals(names, jdbcUsernames(LEGACY_SQL, exact, 5));
    }

    @Test
    void visibilityAndStatusFilterCandidates() {
        String tag = tag();
        String visible = insertUser(tag + "pub", "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T11:00:00Z"));
        insertUser(tag + "pri", "PRIVATE", "ACTIVE", null, Instant.parse("2026-11-21T12:00:00Z"));
        insertUser(tag + "sus", "PUBLIC", "SUSPENDED", null, Instant.parse("2026-11-21T12:00:01Z"));
        String unlistedExact = tag + "unl";
        insertUser(unlistedExact, "UNLISTED", "ACTIVE", null, Instant.parse("2026-11-21T12:00:02Z"));
        insertUser(tag + "unp", "UNLISTED", "ACTIVE", null, Instant.parse("2026-11-21T12:00:03Z"));
        follow(visible, 1);

        List<String> byTag = usernames(profileMapper.searchDiscoverableByHot(tag, 20));
        assertEquals(List.of(tag + "pub"), byTag);
        assertFalse(byTag.contains(tag + "pri"));
        assertFalse(byTag.contains(tag + "sus"));
        assertFalse(byTag.contains(tag + "unp"));

        List<String> byExact = usernames(profileMapper.searchDiscoverableByHot(unlistedExact, 20));
        assertTrue(byExact.contains(unlistedExact));
        assertEquals(byTag, jdbcUsernames(LEGACY_SQL, tag, 20));
        assertEquals(byExact, jdbcUsernames(LEGACY_SQL, unlistedExact, 20));
    }

    @Test
    void keywordMatchesDisplayNameAndHistoryNotUnrelatedHotUser() {
        String tag = tag();
        insertUser(tag + "dn", "PUBLIC", "ACTIVE", "nick " + tag, Instant.parse("2026-11-21T08:00:00Z"));
        String historyUser = insertUser("hist" + tag.substring(1), "PUBLIC", "ACTIVE", null,
                Instant.parse("2026-11-21T07:00:00Z"));
        jdbcTemplate.update("""
                INSERT INTO username_history (id, user_id, username, created_at)
                VALUES (?, ?, ?, NOW())
                """, UUID.randomUUID().toString(), historyUser, tag + "old");
        String decoy = insertUser("zz" + Long.toUnsignedString(System.nanoTime(), 36),
                "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T09:00:00Z"));
        follow(decoy, 40);

        List<String> names = usernames(profileMapper.searchDiscoverableByHot(tag, 20));
        assertTrue(names.contains(tag + "dn"));
        assertTrue(names.contains("hist" + tag.substring(1)));
        assertFalse(names.contains(jdbcTemplate.queryForObject(
                "SELECT username FROM community_profile WHERE user_id = ?", String.class, decoy)));
        assertEquals(names, jdbcUsernames(LEGACY_SQL, tag, 20));
    }

    @Test
    void paginationStopsAtLimitAndServicePathAgrees() {
        String tag = tag();
        Instant base = Instant.parse("2026-11-21T06:00:00Z");
        for (int i = 0; i < 4; i++) {
            String userId = insertUser(tag + "p" + i, "PUBLIC", "ACTIVE", null, base.plusSeconds(i));
            follow(userId, 4 - i);
        }
        List<String> page = usernames(profileMapper.searchDiscoverableByHot(tag, 2));
        assertEquals(2, page.size());
        assertEquals(List.of(tag + "p0", tag + "p1"), page);
        assertEquals(page, jdbcUsernames(LEGACY_SQL, tag, 2));

        List<String> viaService = searchService.search(tag, "USER", "hot", 2).stream()
                .map(SearchResultView::getObjectId)
                .toList();
        assertEquals(page, viaService);
    }

    @Test
    void explainAggregatesFollowsThroughCandidatesNotFullTableGroupBy() {
        String tag = tag();
        String candidate = insertUser(tag + "ex", "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T05:00:00Z"));
        String decoy = insertUser("dcy" + Long.toUnsignedString(System.nanoTime(), 36),
                "PUBLIC", "ACTIVE", null, Instant.parse("2026-11-21T05:00:01Z"));
        follow(candidate, 2);
        follow(decoy, 80);

        String plan = String.join("\n", jdbcTemplate.query(
                "EXPLAIN FORMAT=TREE " + HOT_SQL,
                (rs, row) -> rs.getString(1),
                tag, tag, tag, tag, tag, tag, 10));

        assertFalse(plan.isBlank());
        String compact = plan.toLowerCase();
        assertTrue(
                compact.contains("candidates")
                        || compact.contains("idx_user_follow_followee")
                        || compact.contains("followee_id"),
                () -> "expected candidate-scoped follow aggregation, plan was:\n" + plan);
        assertFalse(
                compact.contains("table scan on user_follow") && !compact.contains("candidates"),
                () -> "user_follow should not be fully scanned without candidate join:\n" + plan);
    }

    private List<String> usernames(List<CommunityProfile> profiles) {
        return profiles.stream().map(CommunityProfile::getUsername).toList();
    }

    private List<String> jdbcUsernames(String sql, String query, int limit) {
        return jdbcTemplate.query(sql, (rs, row) -> rs.getString("username"),
                query, query, query, query, query, query, limit);
    }

    private String tag() {
        return "h" + Long.toUnsignedString(System.nanoTime(), 36);
    }

    private String insertUser(String username, String visibility, String status, String displayName, Instant createdAt) {
        String userId = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO community_user
                  (id, email, password_hash, email_verified_at, status, role, terms_version, created_at)
                VALUES (?, ?, ?, NOW(), ?, 'user', '1.0', ?)
                """, userId, username + "@example.com", HASH, status, Timestamp.from(createdAt));
        jdbcTemplate.update("""
                INSERT INTO community_profile
                  (id, user_id, username, display_name, visibility, lock_version, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?)
                """, UUID.randomUUID().toString(), userId, username, displayName, visibility, Timestamp.from(createdAt));
        return userId;
    }

    private String userId(String username) {
        return jdbcTemplate.queryForObject(
                "SELECT user_id FROM community_profile WHERE username = ?", String.class, username);
    }

    private void follow(String followeeId, int count) {
        for (int i = 0; i < count; i++) {
            jdbcTemplate.update("""
                    INSERT INTO user_follow (id, follower_id, followee_id, created_at)
                    VALUES (?, ?, ?, NOW())
                    """, UUID.randomUUID().toString(), UUID.randomUUID().toString(), followeeId);
        }
    }
}
