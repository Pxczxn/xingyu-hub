package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.dto.ArticleSeriesContextView;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class ArticleSeriesContextIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SeriesMapper seriesMapper;

    @Test
    void listsEveryActiveSeriesInStableIdOrderAndExcludesArchivedSeries() {
        String suffix = UUID.randomUUID().toString();
        String articleId = UUID.randomUUID().toString();
        String firstId = "a" + suffix.substring(1);
        String secondId = "b" + suffix.substring(1);
        String archivedId = "c" + suffix.substring(1);

        insertSeries(firstId, "第一个集合", "first-" + suffix, "ACTIVE");
        insertSeries(secondId, "第二个集合", "second-" + suffix, "ACTIVE");
        insertSeries(archivedId, "已归档集合", "archived-" + suffix, "ARCHIVED");
        insertChapter(UUID.randomUUID().toString(), firstId, articleId, 2);
        insertChapter(UUID.randomUUID().toString(), secondId, articleId, 1);
        insertChapter(UUID.randomUUID().toString(), archivedId, articleId, 4);

        List<ArticleSeriesContextView> contexts = seriesMapper.listActiveContextsByArticleId(articleId);

        assertEquals(List.of(firstId, secondId), contexts.stream().map(ArticleSeriesContextView::getId).toList());
        assertEquals(List.of(2, 1), contexts.stream().map(ArticleSeriesContextView::getPosition).toList());
        assertEquals(List.of("第一个集合", "第二个集合"),
                contexts.stream().map(ArticleSeriesContextView::getTitle).toList());
        assertTrue(seriesMapper.listActiveContextsByArticleId(UUID.randomUUID().toString()).isEmpty());
    }

    private void insertSeries(String id, String title, String slug, String status) {
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
                INSERT INTO series
                    (id, owner_id, space_id, title, slug, description, status, lock_version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, ?)
                """, id, UUID.randomUUID().toString(), UUID.randomUUID().toString(), title, slug, status, now, now);
    }

    private void insertChapter(String id, String seriesId, String articleId, int position) {
        jdbcTemplate.update("""
                INSERT INTO series_chapter (id, series_id, article_id, position, created_at)
                VALUES (?, ?, ?, ?, ?)
                """, id, seriesId, articleId, position, Timestamp.from(Instant.now()));
    }
}
