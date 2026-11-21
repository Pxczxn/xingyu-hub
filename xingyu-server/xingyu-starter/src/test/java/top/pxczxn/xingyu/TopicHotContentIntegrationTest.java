package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 话题热度：真实 MySQL 上验证 listHotContent 只聚合当前话题活 ARTICLE 点赞。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class TopicHotContentIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ArticleTopicMapper articleTopicMapper;

    @Test
    void ranksByLikesThenIndexedAtThenObjectIdIncludingZeros() {
        String topicId = insertTopic("hot-rank");
        Instant t2 = Instant.parse("2026-11-21T12:00:02Z");
        Instant t1 = Instant.parse("2026-11-21T12:00:01Z");
        Instant t0 = Instant.parse("2026-11-21T12:00:00Z");
        String likeNew = insertLiveArticle(topicId, "like-new", t1);
        String likeOld = insertLiveArticle(topicId, "like-old", t0);
        String tieZ = insertLiveArticle(topicId, "tie-z", t2);
        String tieA = insertLiveArticle(topicId, "tie-a", t2);
        String zeroNew = insertLiveArticle(topicId, "zero-new", Instant.parse("2026-11-21T13:00:00Z"));
        like(likeNew, 3);
        like(likeOld, 3);
        like(tieZ, 1);
        like(tieA, 1);

        List<String> ids = ids(articleTopicMapper.listHotContent(topicId, 10));
        assertEquals(List.of(likeNew, likeOld, tieZ, tieA, zeroNew), ids);
    }

    @Test
    void otherTopicHighLikesDoNotAffectCurrentRanking() {
        String current = insertTopic("hot-current");
        String other = insertTopic("hot-other");
        Instant now = Instant.parse("2026-11-21T10:00:00Z");
        String quiet = insertLiveArticle(current, "quiet", now);
        String noisy = insertLiveArticle(other, "noisy", now.plusSeconds(1));
        like(quiet, 1);
        like(noisy, 99);

        List<String> ids = ids(articleTopicMapper.listHotContent(current, 10));
        assertEquals(List.of(quiet), ids);
        assertTrue(ids.stream().noneMatch(noisy::equals));
    }

    @Test
    void zeroLikeArticlesRemainAndRowsAreUnique() {
        String topicId = insertTopic("hot-zero");
        Instant now = Instant.parse("2026-11-21T11:00:00Z");
        String liked = insertLiveArticle(topicId, "liked", now.minusSeconds(1));
        String zero = insertLiveArticle(topicId, "zero", now);
        like(liked, 2);

        List<String> ids = ids(articleTopicMapper.listHotContent(topicId, 10));
        assertEquals(List.of(liked, zero), ids);
        assertEquals(ids.size(), new HashSet<>(ids).size());
    }

    @Test
    void removedIndexMissingArticleAndUnlinkedRowsAreExcluded() {
        String topicId = insertTopic("hot-filter");
        Instant now = Instant.parse("2026-11-21T08:00:00Z");
        String keep = insertLiveArticle(topicId, "keep", now);
        String removed = insertLiveArticle(topicId, "removed", now.plusSeconds(1));
        jdbcTemplate.update(
                "UPDATE search_document SET removed_at = NOW() WHERE object_type = 'ARTICLE' AND object_id = ?",
                removed);
        String orphanLink = UUID.randomUUID().toString();
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, NOW())",
                orphanLink, topicId);
        String noIndex = UUID.randomUUID().toString();
        insertArticleRow(noIndex);
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, NOW())",
                noIndex, topicId);
        like(keep, 1);
        like(removed, 8);
        like(orphanLink, 8);
        like(noIndex, 8);

        List<String> ids = ids(articleTopicMapper.listHotContent(topicId, 10));
        assertEquals(List.of(keep), ids);
    }

    @Test
    void limitIsPrefixOfFullTopicOrder() {
        String topicId = insertTopic("hot-limit");
        Instant now = Instant.parse("2026-11-21T09:00:00Z");
        String a5 = insertLiveArticle(topicId, "a5", now);
        String a4 = insertLiveArticle(topicId, "a4", now.plusSeconds(1));
        String a3 = insertLiveArticle(topicId, "a3", now.plusSeconds(2));
        String a2 = insertLiveArticle(topicId, "a2", now.plusSeconds(3));
        String a1 = insertLiveArticle(topicId, "a1", now.plusSeconds(4));
        like(a5, 5);
        like(a4, 4);
        like(a3, 3);
        like(a2, 2);
        like(a1, 1);

        List<String> full = ids(articleTopicMapper.listHotContent(topicId, 5));
        assertEquals(List.of(a5, a4, a3, a2, a1), full);
        assertEquals(full.subList(0, 2), ids(articleTopicMapper.listHotContent(topicId, 2)));
        assertEquals(full, ids(articleTopicMapper.listHotContent(topicId, 10)));
    }

    @Test
    void emptyTopicAndUnknownTopicReturnEmpty() {
        String empty = insertTopic("hot-empty");
        assertEquals(List.of(), articleTopicMapper.listHotContent(empty, 12));
        assertEquals(List.of(), articleTopicMapper.listHotContent(UUID.randomUUID().toString(), 12));
        assertEquals(List.of(), articleTopicMapper.listHotContent(empty, 0));
    }

    private List<String> ids(List<SearchDocument> documents) {
        return documents.stream().map(SearchDocument::getObjectId).toList();
    }

    private String insertTopic(String slugPrefix) {
        String id = UUID.randomUUID().toString();
        String slug = slugPrefix + "-" + id.substring(0, 8);
        jdbcTemplate.update("""
                INSERT INTO topic (id, seed_key, slug, name, description, status)
                VALUES (?, ?, ?, ?, NULL, 'ACTIVE')
                """, id, slug, slug, slugPrefix);
        return id;
    }

    private String insertLiveArticle(String topicId, String title, Instant indexedAt) {
        String articleId = UUID.randomUUID().toString();
        insertArticleRow(articleId);
        jdbcTemplate.update("""
                INSERT INTO search_document
                  (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
                VALUES (?, 'ARTICLE', ?, ?, NULL, 1, ?, NULL)
                """, UUID.randomUUID().toString(), articleId, title, Timestamp.from(indexedAt));
        jdbcTemplate.update(
                "INSERT INTO article_topic (article_id, topic_id, created_at) VALUES (?, ?, NOW())",
                articleId, topicId);
        return articleId;
    }

    private void insertArticleRow(String articleId) {
        jdbcTemplate.update("""
                INSERT INTO article (id, owner_id, space_id, status, lifecycle_status, moderation_status, created_at, updated_at)
                VALUES (?, ?, ?, 'PUBLISHED', 'PUBLISHED', 'NORMAL', NOW(), NOW())
                """, articleId, UUID.randomUUID().toString(), UUID.randomUUID().toString());
    }

    private void like(String articleId, int count) {
        for (int index = 0; index < count; index++) {
            jdbcTemplate.update("""
                    INSERT INTO content_like (id, user_id, object_type, object_id, created_at)
                    VALUES (?, ?, 'ARTICLE', ?, NOW())
                    """, UUID.randomUUID().toString(), UUID.randomUUID().toString(), articleId);
        }
    }
}
