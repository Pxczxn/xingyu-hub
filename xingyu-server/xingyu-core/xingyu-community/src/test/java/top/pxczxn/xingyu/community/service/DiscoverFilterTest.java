package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.entity.FeaturedContent;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.FeaturedContentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.CursorCodec;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class DiscoverFilterTest {
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final RecommendationService service = new RecommendationService(
            null, null, documents, null, null, null, null, mock(ContentCoverService.class));

    @Test
    void filtersBeforePaginationAndUsesTheReturnedBoundary() {
        Instant time = Instant.parse("2026-10-15T00:00:00Z");
        when(documents.listDiscoverFiltered("design-id", "ARTICLE", null, null, null, 3))
                .thenReturn(List.of(doc("a3", time), doc("a2", time), doc("probe", time)));
        var first = service.discoverPage(2, null, "design-id", "ARTICLE");
        assertThat(first.getItems()).extracting("id").containsExactly("a3", "a2");
        assertThat(first.getNextCursor()).isEqualTo(CursorCodec.encode("ARTICLE", time, "a2"));
        when(documents.listDiscoverFiltered("design-id", "ARTICLE", time, "ARTICLE", "a2", 3))
                .thenReturn(List.of(doc("a1", time.minusSeconds(1))));
        var second = service.discoverPage(2, first.getNextCursor(), "design-id", "ARTICLE");
        assertThat(second.getItems()).extracting("id").containsExactly("a1");
        assertThat(second.getNextCursor()).isNull();
        verify(documents, never()).listActiveByRecency(anyInt());
    }

    @Test
    void rejectsUnsupportedTypesAndInvalidCursors() {
        assertThatThrownBy(() -> service.discoverPage(20, null, null, "INVALID"))
                .isInstanceOf(FieldContractException.class);
        assertThatThrownBy(() -> service.discoverPage(20, "broken", "topic", "ARTICLE"))
                .isInstanceOf(FieldContractException.class);
        verifyNoInteractions(documents);
    }

    @Test
    void existingUnfilteredCallsKeepTheirQuery() {
        when(documents.listActiveByRecency(3)).thenReturn(List.of());
        assertThat(service.discoverPage(2, null).getItems()).isEmpty();
        verify(documents).listActiveByRecency(3);
    }

    @Test
    void featuredSortPagesByEditorialOrderAndRejectsHot() {
        FeaturedContentMapper featured = mock(FeaturedContentMapper.class);
        SearchDocumentMapper docs = mock(SearchDocumentMapper.class);
        RecommendationService featuredService = new RecommendationService(
                null, featured, docs, null, null, null, null, mock(ContentCoverService.class));
        when(featured.listDiscover(null, null, null, null, 3)).thenReturn(List.of(
                featured("a", "obj-a", 0),
                featured("b", "obj-b", 2),
                featured("c", "obj-c", 5)));
        when(docs.findLiveByTypeAndIds(eq("ARTICLE"), anyList())).thenReturn(List.of(
                doc("obj-b", Instant.EPOCH),
                doc("obj-a", Instant.EPOCH)));

        var page = featuredService.discoverPage(2, null, null, null, "featured");

        assertThat(page.getItems()).extracting("id").containsExactly("obj-a", "obj-b");
        assertThat(page.getItems()).allMatch(item -> Boolean.TRUE.equals(item.getFeatured()));
        assertThat(page.getNextCursor()).isEqualTo(CursorCodec.encode("FEATURED", Instant.ofEpochMilli(2), "b"));
        assertThatThrownBy(() -> featuredService.discoverPage(2, null, null, null, "hot"))
                .isInstanceOf(FieldContractException.class);
        verify(docs, never()).listActiveByRecency(anyInt());
    }

    @Test
    void interestSortUsesSelectedDomainTagsAndIsEmptyWithoutThem() {
        Instant newer = Instant.parse("2026-10-16T00:00:00Z");
        when(documents.listDiscoverByDomains(List.of("domain-1"), null, null, null, null, 3))
                .thenReturn(List.of(doc("new", newer), doc("old", newer.minusSeconds(1)), doc("probe", newer.minusSeconds(2))));

        var page = service.discoverPage(2, null, null, null, "interest", List.of("domain-1"));

        assertThat(page.getItems()).extracting("id").containsExactly("new", "old");
        assertThat(service.discoverPage(2, null, null, null, "interest", List.of()).getItems()).isEmpty();
        assertThat(service.discoverPage(2, null, null, "MOMENT", "interest", List.of("domain-1")).getItems()).isEmpty();
        verify(documents, times(1)).listDiscoverByDomains(anyList(), isNull(), isNull(), isNull(), isNull(), anyInt());
    }

    private FeaturedContent featured(String id, String objectId, int sortOrder) {
        FeaturedContent row = new FeaturedContent();
        row.setId(id);
        row.setObjectType("ARTICLE");
        row.setObjectId(objectId);
        row.setSortOrder(sortOrder);
        row.setStatus("ACTIVE");
        return row;
    }

    private SearchDocument doc(String id, Instant time) {
        SearchDocument document = new SearchDocument();
        document.setObjectType("ARTICLE");
        document.setObjectId(id);
        document.setTitle(id);
        document.setIndexedAt(time);
        return document;
    }
}
