package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.dto.SearchResultView;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.ProfileSettingsSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SearchService {

    private final SearchDocumentMapper searchDocumentMapper;
    private final CommunityProfileMapper profileMapper;

    public List<SearchResultView> search(String query, String type, String sort, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        boolean latest = "latest".equals(normalizeSort(sort));
        String normalizedType = normalizeType(type);
        if ("USER".equals(normalizedType)) {
            return searchUsers(query, limit, latest);
        }

        List<SearchDocument> docs;
        if (query == null || query.isBlank()) {
            docs = latest
                    ? searchDocumentMapper.listActiveByLatest(limit)
                    : searchDocumentMapper.listActiveByHot(limit);
        } else {
            docs = latest
                    ? searchDocumentMapper.searchActiveByLatest(query.trim(), limit)
                    : searchDocumentMapper.searchActiveByHot(query.trim(), limit);
        }

        List<SearchResultView> results = new ArrayList<>();
        for (SearchDocument doc : docs) {
            if (normalizedType != null && !normalizedType.equals(doc.getObjectType())) {
                continue;
            }
            results.add(toView(doc));
        }

        if (normalizedType == null && query != null && !query.isBlank()) {
            int userLimit = Math.min(8, limit);
            results.addAll(searchUsers(query, userLimit, latest));
            if (latest) {
                results.sort(Comparator.comparing(this::resolveUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed());
            }
        }

        return results.stream().limit(limit).toList();
    }

    private List<SearchResultView> searchUsers(String query, int limit, boolean latest) {
        if (query == null || query.isBlank()) {
            return List.of();
        }
        List<CommunityProfile> profiles = latest
                ? profileMapper.searchDiscoverableByLatest(query.trim(), limit)
                : profileMapper.searchDiscoverableByHot(query.trim(), limit);
        return profiles.stream()
                .map(this::toUserView)
                .toList();
    }

    private SearchResultView toView(SearchDocument doc) {
        return SearchResultView.builder()
                .objectType(doc.getObjectType())
                .objectId(doc.getObjectId())
                .title(doc.getTitle())
                .summary(doc.getSummary())
                .updatedAt(formatInstant(doc.getIndexedAt()))
                .build();
    }

    private SearchResultView toUserView(CommunityProfile profile) {
        String title = profile.getDisplayName() == null || profile.getDisplayName().isBlank()
                ? profile.getUsername()
                : profile.getDisplayName();
        String summary = profile.getBio() == null || profile.getBio().isBlank()
                ? "@" + profile.getUsername()
                : profile.getBio();
        return SearchResultView.builder()
                .objectType("USER")
                .objectId(profile.getUsername())
                .title(title)
                .summary(summary)
                .avatar(ProfileSettingsSupport.resolveAvatar(profile))
                .updatedAt(formatInstant(profile.getCreatedAt()))
                .build();
    }

    private Instant resolveUpdatedAt(SearchResultView view) {
        if (view.getUpdatedAt() == null || view.getUpdatedAt().isBlank()) {
            return null;
        }
        try {
            return Instant.parse(view.getUpdatedAt());
        } catch (Exception ex) {
            return null;
        }
    }

    private String formatInstant(Instant instant) {
        return instant == null ? null : instant.toString();
    }

    private String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return null;
        }
        String normalized = type.trim().toUpperCase(Locale.ROOT);
        return "ALL".equals(normalized) ? null : normalized;
    }

    private String normalizeSort(String sort) {
        if (sort == null || sort.isBlank()) {
            return "hot";
        }
        String normalized = sort.trim().toLowerCase(Locale.ROOT);
        return "latest".equals(normalized) ? "latest" : "hot";
    }
}
