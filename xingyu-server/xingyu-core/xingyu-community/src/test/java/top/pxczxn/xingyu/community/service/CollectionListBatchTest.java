package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.CollectionEntry;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.UserCollection;
import top.pxczxn.xingyu.community.mapper.CollectionEntryMapper;
import top.pxczxn.xingyu.community.mapper.CollectionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CollectionListBatchTest {

    private final CollectionMapper collections = mock(CollectionMapper.class);
    private final CollectionEntryMapper entries = mock(CollectionEntryMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final CollectionService service = new CollectionService(collections, entries, documents);

    @Test
    void listsCountItemsOnceAndLoadTitlesByType() {
        when(collections.listByOwnerId("me")).thenReturn(List.of(
                collection("full", "PRIVATE"),
                collection("empty", "PRIVATE")));
        when(entries.countByCollectionIds(List.of("full", "empty")))
                .thenReturn(List.of(new ObjectCountRow("full", 4)));
        when(collections.selectById("full")).thenReturn(collection("full", "PUBLIC"));
        when(entries.listByCollectionId("full")).thenReturn(List.of(
                entry("item-1", "ARTICLE", "article-1"),
                entry("item-2", "MOMENT", "moment-1")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("article-1")))
                .thenReturn(List.of(document("ARTICLE", "article-1", "文章标题")));
        when(documents.listByTypeAndIds("MOMENT", List.of("moment-1"))).thenReturn(List.of());

        var mine = service.listMine(user("me"));
        var detail = service.getCollection("full", null);

        assertThat(mine).extracting("itemCount").containsExactly(4L, 0L);
        assertThat(detail.getItems()).extracting("title").containsExactly("文章标题", "moment-1");
        verify(entries).countByCollectionIds(List.of("full", "empty"));
        verify(entries, never()).countByCollectionId(any());
        verify(documents, never()).findByObject(any(), any());
    }

    @Test
    void emptyCollectionListDoesNotCount() {
        when(collections.listByOwnerId("me")).thenReturn(List.of());

        assertThat(service.listMine(user("me"))).isEmpty();

        verify(entries, never()).countByCollectionIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static UserCollection collection(String id, String visibility) {
        UserCollection collection = new UserCollection();
        collection.setId(id);
        collection.setOwnerId("me");
        collection.setName(id);
        collection.setVisibility(visibility);
        return collection;
    }

    private static CollectionEntry entry(String id, String objectType, String objectId) {
        CollectionEntry entry = new CollectionEntry();
        entry.setId(id);
        entry.setObjectType(objectType);
        entry.setObjectId(objectId);
        return entry;
    }

    private static SearchDocument document(String objectType, String objectId, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(objectType);
        document.setObjectId(objectId);
        document.setTitle(title);
        return document;
    }
}
