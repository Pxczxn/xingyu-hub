package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.community.entity.CollectionEntry;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.UserCollection;
import top.pxczxn.xingyu.community.mapper.CollectionEntryMapper;
import top.pxczxn.xingyu.community.mapper.CollectionMapper;

import java.io.Serializable;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CollectionDeleteBatchTest {

    private final CollectionMapper collections = mock(CollectionMapper.class);
    private final CollectionEntryMapper entries = mock(CollectionEntryMapper.class);
    private final CollectionService service = new CollectionService(collections, entries, null);

    @Test
    void deletingACollectionClearsEntriesOnce() {
        when(collections.selectById("col")).thenReturn(owned("col", "me"));

        service.deleteCollection(user("me"), "col");

        verify(entries).deleteByCollectionId("col");
        verify(collections).deleteById("col");
        verify(entries, never()).listByCollectionId(any());
        verify(entries, never()).deleteById(any(Serializable.class));
    }

    @Test
    void foreignCollectionDeletesNothingAndASingleItemStillDeletesById() {
        when(collections.selectById("col")).thenReturn(owned("col", "owner"));

        assertThatThrownBy(() -> service.deleteCollection(user("me"), "col"))
                .isInstanceOf(ContractException.class)
                .extracting(error -> ((ContractException) error).getErrorCode())
                .isEqualTo(ErrorCode.NOT_FOUND);
        verify(entries, never()).deleteByCollectionId(any());
        verify(collections, never()).deleteById(any(Serializable.class));

        when(collections.selectById("col")).thenReturn(owned("col", "me"));
        CollectionEntry entry = new CollectionEntry();
        entry.setId("item");
        entry.setCollectionId("col");
        when(entries.selectById("item")).thenReturn(entry);

        service.removeItem(user("me"), "col", "item");

        verify(entries).deleteById((Serializable) "item");
        verify(entries, never()).deleteByCollectionId(any());
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
        return collection;
    }
}
