package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.CollectionItemView;
import top.pxczxn.xingyu.community.dto.CollectionSummaryView;
import top.pxczxn.xingyu.community.dto.CollectionView;
import top.pxczxn.xingyu.community.entity.CollectionEntry;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.UserCollection;
import top.pxczxn.xingyu.community.mapper.CollectionEntryMapper;
import top.pxczxn.xingyu.community.mapper.CollectionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private final CollectionMapper collectionMapper;
    private final CollectionEntryMapper collectionEntryMapper;
    private final SearchDocumentMapper searchDocumentMapper;

    @Transactional
    public CollectionSummaryView create(CommunityUser user, String title, String visibility) {
        if (title == null || title.isBlank()) {
            throw new FieldContractException("title", "收藏夹名称不能为空");
        }
        String resolvedVisibility = visibility == null || visibility.isBlank() ? "PRIVATE" : visibility;
        Instant now = Instant.now();
        UserCollection collection = new UserCollection();
        collection.setId(TokenSupport.newId());
        collection.setOwnerId(user.getId());
        collection.setName(title.trim());
        collection.setVisibility(resolvedVisibility);
        collection.setCreatedAt(now);
        collection.setUpdatedAt(now);
        collectionMapper.insert(collection);
        return CollectionSummaryView.builder()
                .id(collection.getId())
                .title(collection.getName())
                .visibility(collection.getVisibility())
                .itemCount(0L)
                .build();
    }

    public List<CollectionSummaryView> listMine(CommunityUser user) {
        return collectionMapper.listByOwnerId(user.getId()).stream()
                .map(collection -> CollectionSummaryView.builder()
                        .id(collection.getId())
                        .title(collection.getName())
                        .visibility(collection.getVisibility())
                        .itemCount(collectionEntryMapper.countByCollectionId(collection.getId()))
                        .build())
                .toList();
    }

    public CollectionView getCollection(String collectionId, CommunityUser viewer) {
        UserCollection collection = collectionMapper.selectById(collectionId);
        if (collection == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!canRead(collection, viewer)) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        List<CollectionItemView> items = collectionEntryMapper.listByCollectionId(collectionId).stream()
                .map(this::toItemView)
                .toList();
        return CollectionView.builder()
                .id(collection.getId())
                .title(collection.getName())
                .description(null)
                .visibility(collection.getVisibility())
                .items(items)
                .build();
    }

    @Transactional
    public CollectionItemView addItem(CommunityUser user, String collectionId, String objectType, String objectId) {
        UserCollection collection = requireOwnedCollection(user, collectionId);
        validateObject(objectType, objectId);
        CollectionEntry existing = findEntry(collectionId, objectType, objectId);
        if (existing != null) {
            return toItemView(existing);
        }
        CollectionEntry entry = new CollectionEntry();
        entry.setId(TokenSupport.newId());
        entry.setCollectionId(collection.getId());
        entry.setObjectType(objectType);
        entry.setObjectId(objectId);
        entry.setSortOrder(0);
        entry.setCreatedAt(Instant.now());
        collectionEntryMapper.insert(entry);
        return toItemView(entry);
    }

    @Transactional
    public CollectionItemView bookmark(CommunityUser user, String objectType, String objectId) {
        validateObject(objectType, objectId);
        UserCollection collection = requireDefaultCollection(user);
        return addItem(user, collection.getId(), objectType, objectId);
    }

    @Transactional
    public void removeBookmark(CommunityUser user, String objectType, String objectId) {
        CollectionEntry entry = collectionEntryMapper.findByOwnerAndObject(user.getId(), objectType, objectId);
        if (entry == null) {
            return;
        }
        requireOwnedCollection(user, entry.getCollectionId());
        collectionEntryMapper.deleteById(entry.getId());
    }

    public boolean isBookmarked(CommunityUser user, String objectType, String objectId) {
        return collectionEntryMapper.findByOwnerAndObject(user.getId(), objectType, objectId) != null;
    }

    @Transactional
    public CollectionSummaryView updateCollection(
            CommunityUser user,
            String collectionId,
            String title,
            String visibility) {
        UserCollection collection = requireOwnedCollection(user, collectionId);
        if (title != null && !title.isBlank()) {
            collection.setName(title.trim());
        }
        if (visibility != null && !visibility.isBlank()) {
            collection.setVisibility(visibility);
        }
        collection.setUpdatedAt(Instant.now());
        collectionMapper.updateById(collection);
        return CollectionSummaryView.builder()
                .id(collection.getId())
                .title(collection.getName())
                .visibility(collection.getVisibility())
                .itemCount(collectionEntryMapper.countByCollectionId(collection.getId()))
                .build();
    }

    @Transactional
    public void deleteCollection(CommunityUser user, String collectionId) {
        UserCollection collection = requireOwnedCollection(user, collectionId);
        for (CollectionEntry entry : collectionEntryMapper.listByCollectionId(collectionId)) {
            collectionEntryMapper.deleteById(entry.getId());
        }
        collectionMapper.deleteById(collection.getId());
    }

    @Transactional
    public void removeItem(CommunityUser user, String collectionId, String itemId) {
        requireOwnedCollection(user, collectionId);
        CollectionEntry entry = collectionEntryMapper.selectById(itemId);
        if (entry == null || !collectionId.equals(entry.getCollectionId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        collectionEntryMapper.deleteById(itemId);
    }

    @Transactional
    public CollectionItemView moveItem(
            CommunityUser user,
            String sourceCollectionId,
            String itemId,
            String targetCollectionId) {
        requireOwnedCollection(user, sourceCollectionId);
        UserCollection target = requireOwnedCollection(user, targetCollectionId);
        CollectionEntry entry = collectionEntryMapper.selectById(itemId);
        if (entry == null || !sourceCollectionId.equals(entry.getCollectionId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        CollectionEntry duplicate = findEntry(targetCollectionId, entry.getObjectType(), entry.getObjectId());
        if (duplicate != null) {
            collectionEntryMapper.deleteById(entry.getId());
            return toItemView(duplicate);
        }
        entry.setCollectionId(target.getId());
        collectionEntryMapper.updateById(entry);
        target.setUpdatedAt(Instant.now());
        collectionMapper.updateById(target);
        return toItemView(entry);
    }

    private UserCollection requireOwnedCollection(CommunityUser user, String collectionId) {
        UserCollection collection = collectionMapper.selectById(collectionId);
        if (collection == null || !user.getId().equals(collection.getOwnerId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return collection;
    }

    private UserCollection requireDefaultCollection(CommunityUser user) {
        List<UserCollection> collections = collectionMapper.listByOwnerId(user.getId());
        if (!collections.isEmpty()) {
            return collections.get(0);
        }
        Instant now = Instant.now();
        UserCollection collection = new UserCollection();
        collection.setId(TokenSupport.newId());
        collection.setOwnerId(user.getId());
        collection.setName("默认收藏");
        collection.setVisibility("PRIVATE");
        collection.setCreatedAt(now);
        collection.setUpdatedAt(now);
        collectionMapper.insert(collection);
        return collection;
    }

    private CollectionEntry findEntry(String collectionId, String objectType, String objectId) {
        return collectionEntryMapper.listByCollectionId(collectionId).stream()
                .filter(entry -> objectType.equals(entry.getObjectType()) && objectId.equals(entry.getObjectId()))
                .findFirst()
                .orElse(null);
    }

    private void validateObject(String objectType, String objectId) {
        if (objectType == null || objectType.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        if (objectId == null || objectId.isBlank()) {
            throw new FieldContractException("objectId", "对象 ID 不能为空");
        }
        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "内容不存在或不可收藏");
        }
    }

    private boolean canRead(UserCollection collection, CommunityUser viewer) {
        if ("PUBLIC".equals(collection.getVisibility())) {
            return true;
        }
        return viewer != null && viewer.getId().equals(collection.getOwnerId());
    }

    private CollectionItemView toItemView(CollectionEntry entry) {
        SearchDocument document = searchDocumentMapper.findByObject(entry.getObjectType(), entry.getObjectId());
        String title = document == null ? entry.getObjectId() : document.getTitle();
        return CollectionItemView.builder()
                .id(entry.getId())
                .title(title)
                .objectType(entry.getObjectType())
                .objectId(entry.getObjectId())
                .build();
    }
}
