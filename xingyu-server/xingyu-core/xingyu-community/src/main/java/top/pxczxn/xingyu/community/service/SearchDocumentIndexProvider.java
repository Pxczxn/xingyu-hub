package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchIndexEntry;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Locale;

/**
 * The DB-backed projection behind {@link SearchIndexProvider}: one `search_document` row per
 * public object.
 *
 * <p>This class owns the column limits, because they are a property of THIS provider rather
 * than of the index contract. `search_document.title` is varchar(256) NOT NULL and
 * `summary` is varchar(1024), so an over-long value is truncated here rather than throwing a
 * data-truncation error from MySQL in the middle of a publish.
 *
 * <p>Note the deliberate asymmetry with {@link #remove}: a blank title REMOVES the object
 * instead of writing a row. An indexed object nobody can find is worse than an absent one,
 * and the publish path already refuses blank titles upstream.
 */
@Service
@RequiredArgsConstructor
public class SearchDocumentIndexProvider implements SearchIndexProvider {

    private static final int TITLE_MAX_LENGTH = 256;
    private static final int SUMMARY_MAX_LENGTH = 1024;
    private static final long DISCOVERY_VERSION = 1L;

    private final SearchDocumentMapper searchDocumentMapper;

    @Override
    @Transactional
    public void upsert(SearchIndexEntry entry) {
        String objectType = normalizeType(entry.getObjectType());
        String objectId = entry.getObjectId();
        if (objectType == null || objectId == null || objectId.isBlank()) {
            return;
        }

        String title = truncate(entry.getTitle(), TITLE_MAX_LENGTH);
        if (title == null) {
            remove(objectType, objectId);
            return;
        }

        Instant now = Instant.now();
        String summary = truncate(entry.getSummary(), SUMMARY_MAX_LENGTH);

        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            SearchDocument document = new SearchDocument();
            document.setId(TokenSupport.newId());
            document.setObjectType(objectType);
            document.setObjectId(objectId);
            document.setTitle(title);
            document.setSummary(summary);
            document.setDiscoveryVersion(DISCOVERY_VERSION);
            document.setIndexedAt(now);
            document.setRemovedAt(null);
            searchDocumentMapper.insert(document);
            return;
        }

        // Goes through an explicit UPDATE (see the mapper) so that `removed_at` is really
        // cleared — `updateById` would omit the null and leave the object invisible.
        searchDocumentMapper.refreshContent(
                objectType, objectId, title, summary, DISCOVERY_VERSION, now);
    }

    @Override
    @Transactional
    public void remove(String objectType, String objectId) {
        String type = normalizeType(objectType);
        if (type == null || objectId == null || objectId.isBlank()) {
            return;
        }
        searchDocumentMapper.markRemoved(type, objectId, Instant.now());
    }

    private static String normalizeType(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    /** Trimmed, truncated to the column width; null when there is nothing worth storing. */
    private static String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
