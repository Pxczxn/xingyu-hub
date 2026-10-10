package top.pxczxn.xingyu;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.service.SearchService;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
class SearchQueryCorrectnessIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private SearchService searchService;

    @Test
    void likeWildcardsAreSearchedAsLiteralCharacters() {
        String marker = "literal" + System.nanoTime();
        insert("ARTICLE", "100%_" + marker, Instant.now());
        insert("ARTICLE", "ordinary" + marker, Instant.now().minusSeconds(1));

        List<SearchResultView> percent = searchService.search("%", "ARTICLE", "hot", 20);
        List<SearchResultView> underscore = searchService.search("_", "ARTICLE", "hot", 20);

        assertEquals(1, percent.stream().filter(item -> item.getTitle().contains(marker)).count());
        assertEquals(1, underscore.stream().filter(item -> item.getTitle().contains(marker)).count());
        assertTrue(percent.stream().filter(item -> item.getTitle().contains(marker))
                .allMatch(item -> item.getTitle().contains("%")));
        assertTrue(underscore.stream().filter(item -> item.getTitle().contains(marker))
                .allMatch(item -> item.getTitle().contains("_")));
    }

    @Test
    void typeFilterIsAppliedBeforeLimit() {
        String marker = "typefilter" + System.nanoTime();
        Instant now = Instant.now();
        for (int index = 0; index < 25; index++) {
            insert("SERIES", marker + " series " + index, now.plusSeconds(index + 1));
        }
        String articleId = insert("ARTICLE", marker + " article", now);

        List<SearchResultView> articles = searchService.search(marker, "ARTICLE", "latest", 1);
        List<SearchResultView> all = searchService.search(marker, "ALL", "latest", 30);

        assertEquals(List.of(articleId), articles.stream().map(SearchResultView::getObjectId).toList());
        assertEquals(26, all.size());
    }

    private String insert(String objectType, String title, Instant indexedAt) {
        String id = UUID.randomUUID().toString();
        jdbcTemplate.update("""
                INSERT INTO search_document
                  (id, object_type, object_id, title, summary, discovery_version, indexed_at, removed_at)
                VALUES (?, ?, ?, ?, NULL, 1, ?, NULL)
                """, UUID.randomUUID().toString(), objectType, id, title, Timestamp.from(indexedAt));
        return id;
    }
}
