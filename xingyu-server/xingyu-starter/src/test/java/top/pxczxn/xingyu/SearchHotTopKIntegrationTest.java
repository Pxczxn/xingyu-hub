package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.service.SearchService;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 通用热度 A2：真实 MySQL 上验证 listActiveByHot / searchActiveByHot 的集合与次序。
 * 使用独立 object_type，避免和测试库里已有 ARTICLE 行抢排名。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class SearchHotTopKIntegrationTest {

    private static final String TYPE = "HOTQA";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SearchDocumentMapper searchDocumentMapper;

    @Autowired
    private SearchService searchService;

    @Test
    void likesOutrankZerosThenIndexedAtThenObjectId() {
        Instant t2 = Instant.parse("2026-11-21T12:00:02Z");
        Instant t1 = Instant.parse("2026-11-21T12:00:01Z");
        Instant t0 = Instant.parse("2026-11-21T12:00:00Z");
        insertDoc("like-new", "alpha", t1);
        insertDoc("like-old", "alpha", t0);
        insertDoc("tie-z", "alpha", t2);
        insertDoc("tie-a", "alpha", t2);
        insertDoc("zero-new", "alpha", Instant.parse("2026-11-21T13:00:00Z"));
        like("like-new", 3);
        like("like-old", 3);
        like("tie-z", 1);
        like("tie-a", 1);

        List<String> ids = ids(searchDocumentMapper.listActiveByHot(TYPE, 10));
        assertEquals(List.of("like-new", "like-old", "tie-z", "tie-a", "zero-new"), ids);
    }

    @Test
    void fillDoesNotDuplicateOrDisplaceLikedWhenShortOfK() {
        Instant now = Instant.parse("2026-11-21T10:00:00Z");
        insertDoc("liked", "fillcase", now.minusSeconds(30));
        insertDoc("zero-2", "fillcase", now.minusSeconds(2));
        insertDoc("zero-1", "fillcase", now.minusSeconds(1));
        like("liked", 2);

        List<String> ids = ids(searchDocumentMapper.listActiveByHot(TYPE, 3));
        assertEquals(List.of("liked", "zero-1", "zero-2"), ids);
    }

    @Test
    void fullLikedPageSkipsNewerZero() {
        Instant now = Instant.parse("2026-11-21T11:00:00Z");
        insertDoc("l1", "fullk", now.minusSeconds(3));
        insertDoc("l2", "fullk", now.minusSeconds(2));
        insertDoc("newer-zero", "fullk", now);
        like("l1", 5);
        like("l2", 4);

        List<String> ids = ids(searchDocumentMapper.listActiveByHot(TYPE, 2));
        assertEquals(List.of("l1", "l2"), ids);
    }

    @Test
    void keywordCountsOnlyMatchingCandidatesAndFillsFromMatches() {
        Instant now = Instant.parse("2026-11-21T09:00:00Z");
        insertDoc("hit-liked", "needle-hot", now.minusSeconds(4));
        insertDoc("hit-zero", "needle-hot", now);
        insertDoc("miss-liked", "other-title", now.minusSeconds(1));
        like("hit-liked", 1);
        like("miss-liked", 9);

        List<String> ids = ids(searchDocumentMapper.searchActiveByHot("needle-hot", TYPE, 5));
        assertEquals(List.of("hit-liked", "hit-zero"), ids);
    }

    @Test
    void typeFilterExcludesOtherTypesRemovedAndOrphans() {
        Instant now = Instant.parse("2026-11-21T08:00:00Z");
        insertDoc("keep", "typed", now);
        insertTyped("SERIES", "series-hot", "typed series", now.plusSeconds(1));
        String removedId = "gone";
        insertDoc(removedId, "typed", now.plusSeconds(2));
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = ? AND object_id = ?",
                TYPE, removedId);
        like("keep", 1);
        like("series-hot", 8);
        like(removedId, 8);
        insertLike("ARTICLE", UUID.randomUUID().toString(), UUID.randomUUID().toString());

        List<String> ids = ids(searchDocumentMapper.listActiveByHot(TYPE, 10));
        assertEquals(List.of("keep"), ids);
        assertTrue(ids.stream().noneMatch(id -> id.equals("series-hot") || id.equals(removedId)));
    }

    @Test
    void unlikeIsVisibleOnNextHotQuery() {
        Instant now = Instant.parse("2026-11-21T07:00:00Z");
        insertDoc("volatile", "live-like", now.minusSeconds(5));
        insertDoc("steady", "live-like", now);
        like("volatile", 2);
        like("steady", 1);

        assertEquals(List.of("volatile", "steady"), ids(searchDocumentMapper.listActiveByHot(TYPE, 2)));
        jdbcTemplate.update(
                "DELETE FROM content_like WHERE object_type = ? AND object_id = ?",
                TYPE, "volatile");
        assertEquals(0, jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM content_like WHERE object_type = ? AND object_id = ?",
                Integer.class, TYPE, "volatile"));
        assertEquals(List.of("steady", "volatile"), ids(searchDocumentMapper.listActiveByHot(TYPE, 10)).subList(0, 2));
    }

    @Test
    void emptyTypeAndNonPositiveLimit() {
        assertEquals(List.of(), searchDocumentMapper.listActiveByHot(TYPE, 0));
        List<SearchDocument> global = searchDocumentMapper.listActiveByHot(null, 1);
        assertTrue(global.size() <= 1);
        List<String> clamped = searchService.search("", TYPE, "hot", 0).stream()
                .map(top.pxczxn.xingyu.community.dto.SearchResultView::getObjectId)
                .toList();
        List<String> twenty = searchService.search("", TYPE, "hot", 20).stream()
                .map(top.pxczxn.xingyu.community.dto.SearchResultView::getObjectId)
                .toList();
        assertEquals(twenty, clamped);
    }

    private List<String> ids(List<SearchDocument> documents) {
        return documents.stream().map(SearchDocument::getObjectId).toList();
    }

    private void insertDoc(String objectId, String title, Instant indexedAt) {
        insertTyped(TYPE, objectId, title, indexedAt);
    }

    private void insertTyped(String objectType, String objectId, String title, Instant indexedAt) {
        jdbcTemplate.update("""
                INSERT INTO search_document
                  (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
                VALUES (?, ?, ?, ?, NULL, 1, ?, NULL)
                """, UUID.randomUUID().toString(), objectType, objectId, title, Timestamp.from(indexedAt));
    }

    private void like(String objectId, int count) {
        for (int index = 0; index < count; index++) {
            insertLike(TYPE, objectId, UUID.randomUUID().toString());
        }
    }

    private String insertLike(String objectType, String objectId, String userId) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO content_like (id, user_id, object_type, object_id, created_at)
                VALUES (?, ?, ?, ?, NOW())
                """, id, userId, objectType, objectId);
        return id;
    }
}
