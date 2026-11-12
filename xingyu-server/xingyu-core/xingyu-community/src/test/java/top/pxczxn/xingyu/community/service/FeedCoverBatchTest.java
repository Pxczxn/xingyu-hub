package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Galaxy;
import top.pxczxn.xingyu.community.entity.GalaxyContent;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyContentMapper;
import top.pxczxn.xingyu.community.mapper.GalaxyMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FeedCoverBatchTest {

    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final ContentCoverService covers = mock(ContentCoverService.class);
    private final HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
    private final SearchService search = new SearchService(documents, covers, null);
    private final HomeService home = new HomeService(
            null, documents, null, null, null, null, null, null, null, covers, enrichment, null, null);
    private final GalaxyMapper galaxies = mock(GalaxyMapper.class);
    private final GalaxyContentMapper galaxyContents = mock(GalaxyContentMapper.class);
    private final GalaxyService galaxy = new GalaxyService(
            galaxies, null, null, galaxyContents, null, null, null, null, documents, covers, enrichment);

    @Test
    void searchHomeAndGalaxyUseOneCoverBatch() {
        when(documents.listActiveByLatest(isNull(), eq(2))).thenReturn(List.of(
                document("ARTICLE", "a1", "文章"),
                document("SERIES", "s1", "系列")));
        when(documents.listActiveByHot(isNull(), eq(10))).thenReturn(List.of(document("ARTICLE", "a1", "文章")));
        when(covers.resolveDocumentCovers(any())).thenReturn(Map.of("a1", "https://cover"));
        when(enrichment.enrich(anyList(), isNull())).thenReturn(Map.of());
        when(enrichment.applyViews(anyList(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(galaxies.findBySlug("mars")).thenReturn(galaxy("g1"));
        when(galaxyContents.listByGalaxyId("g1", 2)).thenReturn(List.of(
                content("ARTICLE", "a1"),
                content("MOMENT", "m1")));
        when(documents.findLiveByTypeAndIds(eq("ARTICLE"), anyList()))
                .thenReturn(List.of(document("ARTICLE", "a1", "文章")));
        when(documents.findLiveByTypeAndIds(eq("MOMENT"), anyList()))
                .thenReturn(List.of(document("MOMENT", "m1", "片刻")));

        var searched = search.search(null, null, "latest", 2);
        var composed = home.compose(null);
        var mounted = galaxy.listContent("mars", 2);

        assertThat(searched).extracting("title").containsExactly("文章", "系列");
        assertThat(searched).extracting("cover").containsExactly("https://cover", null);
        assertThat(composed.getDiscoveries()).extracting("cover").containsExactly("https://cover");
        assertThat(mounted).extracting("title").containsExactly("文章", "片刻");
        assertThat(mounted).extracting("cover").containsExactly("https://cover", null);
        verify(covers, never()).resolveCoverUrl(any());
    }

    @Test
    void nonArticlesDoNotResolveCovers() {
        PublishedRevisionMapper published = mock(PublishedRevisionMapper.class);
        ContentCoverService resolver = new ContentCoverService(published, mock(FormalRevisionMapper.class));

        assertThat(resolver.resolveDocumentCovers(List.of(document("SERIES", "s1", "系列")))).isEmpty();
        assertThat(resolver.resolveDocumentCovers(List.of())).isEmpty();

        verify(published, never()).listByArticleIds(any());
    }

    private static SearchDocument document(String type, String id, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(type);
        document.setObjectId(id);
        document.setTitle(title);
        document.setIndexedAt(Instant.parse("2026-10-30T00:00:00Z"));
        return document;
    }

    private static Galaxy galaxy(String id) {
        Galaxy galaxy = new Galaxy();
        galaxy.setId(id);
        galaxy.setSlug("mars");
        return galaxy;
    }

    private static GalaxyContent content(String type, String objectId) {
        GalaxyContent content = new GalaxyContent();
        content.setObjectType(type);
        content.setObjectId(objectId);
        return content;
    }
}
