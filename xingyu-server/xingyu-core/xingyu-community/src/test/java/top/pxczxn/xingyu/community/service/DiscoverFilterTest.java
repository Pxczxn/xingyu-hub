package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.entity.SearchDocument;
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

    private SearchDocument doc(String id, Instant time) {
        SearchDocument document = new SearchDocument();
        document.setObjectType("ARTICLE");
        document.setObjectId(id);
        document.setTitle(id);
        document.setIndexedAt(time);
        return document;
    }
}
