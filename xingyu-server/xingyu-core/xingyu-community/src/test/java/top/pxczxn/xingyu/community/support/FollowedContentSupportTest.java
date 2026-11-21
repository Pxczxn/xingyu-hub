package top.pxczxn.xingyu.community.support;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.SearchDocument;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class FollowedContentSupportTest {

    @Test
    void perTypeTopKMatchesFullScanForFiftyAuthors() {
        List<SearchDocument> articles = new ArrayList<>();
        List<SearchDocument> series = new ArrayList<>();
        List<SearchDocument> moments = new ArrayList<>();
        Instant newest = Instant.parse("2026-11-21T00:00:00Z");
        for (int author = 0; author < 50; author++) {
            for (int n = 0; n < 8; n++) {
                articles.add(doc("ARTICLE", "a-" + author + "-" + n,
                        newest.minusSeconds(author * 100L + n)));
            }
            series.add(doc("SERIES", "s-" + author, newest.minusSeconds(author * 100L + 40)));
            moments.add(doc("MOMENT", "m-" + author, newest.minusSeconds(author * 100L + 20)));
        }

        int limit = 10;
        List<SearchDocument> baseline = FollowedContentSupport.newestIndexed(concat(articles, series, moments), limit);
        List<SearchDocument> pushed = FollowedContentSupport.newestIndexed(concat(
                FollowedContentSupport.newestIndexed(articles, limit),
                FollowedContentSupport.newestIndexed(series, limit),
                moments), limit);

        assertThat(keys(pushed)).isEqualTo(keys(baseline));
        assertThat(pushed).hasSize(limit);
        assertThat(articles).hasSize(400);
        assertThat(FollowedContentSupport.newestIndexed(articles, limit)).hasSize(limit);
        assertThat(FollowedContentSupport.newestIndexed(series, limit)).hasSize(limit);
    }

    @Test
    void prolificAuthorLaterPagesDoNotHideNewerQuietAuthor() {
        Instant t = Instant.parse("2026-11-21T12:00:00Z");
        List<SearchDocument> articles = new ArrayList<>();
        for (int n = 0; n < 15; n++) {
            articles.add(doc("ARTICLE", "prolific-" + n, t.minusSeconds(n)));
        }
        SearchDocument quiet = doc("ARTICLE", "quiet-0", t.minusSeconds(5));
        articles.add(quiet);
        int limit = 10;
        List<SearchDocument> baseline = FollowedContentSupport.newestIndexed(articles, limit);
        List<SearchDocument> pushed = FollowedContentSupport.newestIndexed(
                FollowedContentSupport.newestIndexed(articles, limit), limit);

        assertThat(keys(pushed)).isEqualTo(keys(baseline));
        assertThat(keys(baseline)).contains("ARTICLE:quiet-0");
        assertThat(keys(baseline)).doesNotContain("ARTICLE:prolific-10");
        assertThat(keys(baseline)).contains("ARTICLE:prolific-0");
    }

    @Test
    void emptyAndNullInputsStayEmpty() {
        assertThat(FollowedContentSupport.newestIndexed(List.of(), 10)).isEmpty();
        assertThat(FollowedContentSupport.newestIndexed(null, 10)).isEmpty();
        assertThat(FollowedContentSupport.newestIndexed(List.of(doc("ARTICLE", "a", Instant.now())), 0)).isEmpty();
    }

    @Test
    void equalIndexedAtUsesObjectIdDescending() {
        Instant same = Instant.parse("2026-01-01T00:00:00Z");
        List<SearchDocument> docs = List.of(
                doc("ARTICLE", "aa", same),
                doc("ARTICLE", "zz", same),
                doc("SERIES", "mm", same));
        assertThat(keys(FollowedContentSupport.newestIndexed(docs, 3)))
                .containsExactly("ARTICLE:zz", "SERIES:mm", "ARTICLE:aa");
    }

    private static List<String> keys(List<SearchDocument> documents) {
        return documents.stream()
                .map(document -> document.getObjectType() + ":" + document.getObjectId())
                .collect(Collectors.toList());
    }

    @SafeVarargs
    private static List<SearchDocument> concat(List<SearchDocument>... parts) {
        List<SearchDocument> all = new ArrayList<>();
        for (List<SearchDocument> part : parts) {
            all.addAll(part);
        }
        return all;
    }

    private static SearchDocument doc(String type, String id, Instant indexedAt) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(type);
        document.setObjectId(id);
        document.setIndexedAt(indexedAt);
        document.setTitle(id);
        return document;
    }
}
