package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
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

class CollectionEntryLookupBatchTest {

    private final CollectionMapper collections = mock(CollectionMapper.class);
    private final CollectionEntryMapper entries = mock(CollectionEntryMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final CollectionService service = new CollectionService(collections, entries, documents);

    @Test
    void addingOrMovingUsesOneLookupAndReusesTheExistingRow() {
        when(collections.selectById("col")).thenReturn(owned("col", "me"));
        when(collections.selectById("target")).thenReturn(owned("target", "me"));
        when(documents.findByObject("ARTICLE", "a1")).thenReturn(document("ARTICLE", "a1", "Essay"));
        CollectionEntry existing = entry("item", "col", "ARTICLE", "a1");
        when(entries.findByCollectionAndObject("col", "ARTICLE", "a1")).thenReturn(existing);
        CollectionEntry duplicate = entry("dup", "target", "ARTICLE", "a1");
        when(entries.findByCollectionAndObject("target", "ARTICLE", "a1")).thenReturn(duplicate);
        when(entries.selectById("item")).thenReturn(existing);

        var added = service.addItem(user("me"), "col", "ARTICLE", "a1");
        var moved = service.moveItem(user("me"), "col", "item", "target");

        assertThat(added.getId()).isEqualTo("item");
        assertThat(moved.getId()).isEqualTo("dup");
        verify(entries, never()).listByCollectionId(any());
        verify(entries, never()).insert(any());
    }

    @Test
    void openingACollectionStillListsEntriesAndANewItemDoesNotScanTheFolder() {
        when(collections.selectById("col")).thenReturn(owned("col", "me"));
        when(entries.listByCollectionId("col")).thenReturn(List.of(entry("item", "col", "ARTICLE", "a1")));
        when(documents.listByTypeAndIds("ARTICLE", List.of("a1")))
                .thenReturn(List.of(document("ARTICLE", "a1", "Essay")));

        var view = service.getCollection("col", user("me"));

        assertThat(view.getItems()).extracting("id").containsExactly("item");
        verify(entries).listByCollectionId("col");
        verify(entries, never()).findByCollectionAndObject(any(), any(), any());

        when(documents.findByObject("ARTICLE", "a2")).thenReturn(document("ARTICLE", "a2", "Note"));
        when(entries.findByCollectionAndObject("col", "ARTICLE", "a2")).thenReturn(null);

        var added = service.addItem(user("me"), "col", "ARTICLE", "a2");

        assertThat(added.getObjectId()).isEqualTo("a2");
        verify(entries).insert(any());
        verify(entries).findByCollectionAndObject("col", "ARTICLE", "a2");
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static UserCollection owned(String id, String ownerId) {
        UserCollection collection = new UserCollection();
        collection.setId(id);
        collection.setOwnerId(ownerId);
        collection.setName(id);
        collection.setVisibility("PRIVATE");
        return collection;
    }

    private static CollectionEntry entry(String id, String collectionId, String objectType, String objectId) {
        CollectionEntry entry = new CollectionEntry();
        entry.setId(id);
        entry.setCollectionId(collectionId);
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
