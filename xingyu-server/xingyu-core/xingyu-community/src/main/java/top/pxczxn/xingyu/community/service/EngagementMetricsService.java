package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.mapper.CollectionEntryMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class EngagementMetricsService {

    private final ContentLikeMapper likeMapper;
    private final CollectionEntryMapper collectionEntryMapper;
    private final CommentMapper commentMapper;

    public Map<String, Long> likeCounts(String objectType, List<String> objectIds) {
        if (objectIds == null || objectIds.isEmpty()) {
            return Map.of();
        }
        return toCountMap(likeMapper.countByObjectIds(objectType, objectIds));
    }

    /**
     * Visible-comment counts for many objects of one type.
     *
     * <p>Counts only {@code status = 'VISIBLE'} rows, so the number a feed shows
     * matches the number its detail page will actually list.
     */
    public Map<String, Long> commentCounts(String objectType, List<String> objectIds) {
        if (objectIds == null || objectIds.isEmpty()) {
            return Map.of();
        }
        return toCountMap(commentMapper.countByObjectIds(objectType, objectIds));
    }

    public Map<String, Long> bookmarkCounts(String objectType, List<String> objectIds) {
        if (objectIds == null || objectIds.isEmpty()) {
            return Map.of();
        }
        return toCountMap(collectionEntryMapper.countByObjectIds(objectType, objectIds));
    }

    /**
     * The subset of {@code objectIds} the given user has already bookmarked.
     *
     * <p>VIEWER-SCOPED, unlike the count methods above — the answer differs per user, so this
     * one needs a real owner. A null/blank owner is not an error: it means "nobody is signed
     * in", and a guest simply has nothing bookmarked.
     */
    public Set<String> bookmarkedObjectIds(
            String ownerId, String objectType, List<String> objectIds) {
        if (ownerId == null || ownerId.isBlank() || objectIds == null || objectIds.isEmpty()) {
            return Set.of();
        }
        List<String> ids = collectionEntryMapper.findBookmarkedObjectIds(ownerId, objectType, objectIds);
        return ids == null ? Set.of() : new HashSet<>(ids);
    }

    /**
     * The subset of {@code objectIds} the given user has already liked.
     *
     * <p>VIEWER-SCOPED, like {@link #bookmarkedObjectIds} — a null/blank user is not an error,
     * it just means nobody is signed in and nothing can be "liked by the viewer".
     */
    public Set<String> likedObjectIds(String userId, String objectType, List<String> objectIds) {
        if (userId == null || userId.isBlank() || objectIds == null || objectIds.isEmpty()) {
            return Set.of();
        }
        List<String> ids = likeMapper.findLikedObjectIds(userId, objectType, objectIds);
        return ids == null ? Set.of() : new HashSet<>(ids);
    }

    private Map<String, Long> toCountMap(List<ObjectCountRow> rows) {
        Map<String, Long> counts = new HashMap<>();
        if (rows == null) {
            return counts;
        }
        for (ObjectCountRow row : rows) {
            counts.put(row.getObjectId(), row.getCount());
        }
        return counts;
    }
}
