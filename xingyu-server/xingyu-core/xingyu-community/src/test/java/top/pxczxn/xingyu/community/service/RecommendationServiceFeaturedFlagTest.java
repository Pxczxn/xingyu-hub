package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.RecommendationFeedView;
import top.pxczxn.xingyu.community.entity.FeaturedContent;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FeaturedContentMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The {@code featured} flag that Discover tells the client about.
 *
 * <p>Added 2026-10-04 with the flag itself. The client used to infer the editorial boundary
 * from list POSITION — {@code items[0]} as the focus card, {@code items[1..3]} as secondary —
 * which happened to be right only while {@code featured_content} held exactly the right number
 * of rows. That is a guess about product semantics derived from an array index, and it silently
 * mislabels ordinary content the moment the curated count changes.
 *
 * <p>What is worth pinning, and what a re-implementation could plausibly get wrong:
 * <ul>
 *   <li>the flag comes from a real {@code featured_content} match, so a row whose index
 *       document is missing does NOT let the flag slide onto the next item;</li>
 *   <li>the popular fill is marked {@code false}, not left null, so on this surface a client
 *       never has to read "not a pick" and "not classified" as the same thing;</li>
 *   <li>a document that is BOTH a pick and a popular candidate survives dedupe once, as
 *       {@code featured = true};</li>
 *   <li>the returned ORDER is untouched by any of this.</li>
 * </ul>
 *
 * <p>Unit test with mocked mappers rather than the integration suite: the decision is pure
 * control flow over mapper results, and the integration tests need a live MySQL.
 */
class RecommendationServiceFeaturedFlagTest {

    private ClientSettingsService clientSettingsService;
    private FeaturedContentMapper featuredContentMapper;
    private SearchDocumentMapper searchDocumentMapper;
    private UserFollowMapper userFollowMapper;
    private ArticleMapper articleMapper;
    private SeriesMapper seriesMapper;
    private MomentMapper momentMapper;
    private ContentCoverService contentCoverService;

    private RecommendationService service;

    @BeforeEach
    void setUp() {
        clientSettingsService = mock(ClientSettingsService.class);
        featuredContentMapper = mock(FeaturedContentMapper.class);
        searchDocumentMapper = mock(SearchDocumentMapper.class);
        userFollowMapper = mock(UserFollowMapper.class);
        articleMapper = mock(ArticleMapper.class);
        seriesMapper = mock(SeriesMapper.class);
        momentMapper = mock(MomentMapper.class);
        contentCoverService = mock(ContentCoverService.class);
        when(contentCoverService.resolveCoverUrl(any())).thenReturn(null);
        service = new RecommendationService(
                clientSettingsService,
                featuredContentMapper,
                searchDocumentMapper,
                userFollowMapper,
                articleMapper,
                seriesMapper,
                momentMapper,
                contentCoverService);
    }

    /** A real {@code featured_content} row. */
    private static FeaturedContent editorialRow(String objectId, int sortOrder) {
        FeaturedContent row = new FeaturedContent();
        row.setId("fc-" + objectId);
        row.setObjectType("ARTICLE");
        row.setObjectId(objectId);
        row.setSortOrder(sortOrder);
        row.setStatus("ACTIVE");
        row.setCreatedAt(Instant.parse("2026-09-01T00:00:00Z"));
        return row;
    }

    private static SearchDocument indexed(String objectId) {
        SearchDocument document = new SearchDocument();
        document.setId("sd-" + objectId);
        document.setObjectType("ARTICLE");
        document.setObjectId(objectId);
        document.setTitle("标题 " + objectId);
        document.setSummary("摘要 " + objectId);
        document.setDiscoveryVersion(1L);
        document.setIndexedAt(Instant.parse("2026-09-10T00:00:00Z"));
        return document;
    }

    /** Resolves a featured row's index document by its object id. */
    private void resolveEveryFeaturedRow() {
        when(searchDocumentMapper.findByObject(anyString(), anyString()))
                .thenAnswer(invocation -> indexed(invocation.getArgument(1)));
    }

    @Test
    @DisplayName("marks the real picked rows true and the popular fill false, in that order")
    void marksPickedRowsTrueAndFillFalse() {
        when(featuredContentMapper.listActive(anyInt()))
                .thenReturn(List.of(editorialRow("a", 0), editorialRow("b", 1)));
        resolveEveryFeaturedRow();
        when(searchDocumentMapper.listActiveByHot(isNull(), anyInt()))
                .thenReturn(List.of(indexed("a"), indexed("c"), indexed("d")));

        RecommendationFeedView feed = service.recommend(null, 5);

        // "a" appears in both rails and survives ONCE, as a pick. Order is unchanged:
        // picks first, then the popular fill.
        assertThat(feed.getItems())
                .extracting(ContentCardView::getId, ContentCardView::getFeatured)
                .containsExactly(
                        tuple("a", true),
                        tuple("b", true),
                        tuple("c", false),
                        tuple("d", false));
    }

    @Test
    @DisplayName("marks everything false when there are no editorial rows at all")
    void noEditorialRowsMeansEverythingFalse() {
        when(featuredContentMapper.listActive(anyInt())).thenReturn(List.of());
        when(searchDocumentMapper.listActiveByHot(isNull(), anyInt()))
                .thenReturn(List.of(indexed("x"), indexed("y")));

        RecommendationFeedView feed = service.recommend(null, 5);

        // Not null — the popular fill is classified, it is simply not a pick.
        assertThat(feed.getItems())
                .allMatch(item -> Boolean.FALSE.equals(item.getFeatured()));
    }

    @Test
    @DisplayName("a pick whose index row is gone is dropped, and the flag does NOT slide onward")
    void flagDoesNotSlideWhenAPickIsUnresolvable() {
        when(featuredContentMapper.listActive(anyInt()))
                .thenReturn(List.of(editorialRow("gone", 0)));
        // The featured row's index document has been removed.
        when(searchDocumentMapper.findByObject(anyString(), anyString())).thenReturn(null);
        when(searchDocumentMapper.listActiveByHot(isNull(), anyInt())).thenReturn(List.of(indexed("c")));

        RecommendationFeedView feed = service.recommend(null, 5);

        /*
         * The one surviving card is ordinary content and must say so. If the flag were
         * derived from "the first N results" it would have become true here — that is
         * exactly the position-based guess this field replaced.
         */
        assertThat(feed.getItems())
                .extracting(ContentCardView::getId, ContentCardView::getFeatured)
                .containsExactly(tuple("c", false));
    }

    @Test
    @DisplayName("dedupe keeps exactly one entry per object, and the picked copy wins")
    void dedupeKeepsThePickedCopy() {
        when(featuredContentMapper.listActive(anyInt()))
                .thenReturn(List.of(editorialRow("dup", 0)));
        resolveEveryFeaturedRow();
        when(searchDocumentMapper.listActiveByHot(isNull(), anyInt()))
                .thenReturn(List.of(indexed("dup"), indexed("z")));

        RecommendationFeedView feed = service.recommend(null, 5);

        assertThat(feed.getItems()).hasSize(2);
        assertThat(feed.getItems())
                .filteredOn(item -> "dup".equals(item.getId()))
                .singleElement()
                .extracting(ContentCardView::getFeatured)
                .isEqualTo(true);
        assertThat(feed.getItems()).extracting(ContentCardView::getId).containsExactly("dup", "z");
    }

    @Test
    @DisplayName("leaves the ranking strategy untouched")
    void strategyIsUnchanged() {
        when(featuredContentMapper.listActive(anyInt()))
                .thenReturn(List.of(editorialRow("a", 0)));
        resolveEveryFeaturedRow();
        when(searchDocumentMapper.listActiveByHot(isNull(), anyInt())).thenReturn(List.of(indexed("b")));

        // A guest request with picks is "FEATURED_POPULAR" — the same string as before the
        // field existed. Adding `featured` must not have leaked ranking internals.
        assertThat(service.recommend(null, 5).getStrategy()).isEqualTo("FEATURED_POPULAR");
    }
}
