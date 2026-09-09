package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.mapper.CollectionEntryMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EngagementMetricsService {

    private final ContentLikeMapper likeMapper;
    private final CollectionEntryMapper collectionEntryMapper;

    public Map<String, Long> likeCounts(String objectType, List<String> objectIds) {
        if (objectIds == null || objectIds.isEmpty()) {
            return Map.of();
        }
        return toCountMap(likeMapper.countByObjectIds(objectType, objectIds));
    }

    public Map<String, Long> bookmarkCounts(String objectType, List<String> objectIds) {
        if (objectIds == null || objectIds.isEmpty()) {
            return Map.of();
        }
        return toCountMap(collectionEntryMapper.countByObjectIds(objectType, objectIds));
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
