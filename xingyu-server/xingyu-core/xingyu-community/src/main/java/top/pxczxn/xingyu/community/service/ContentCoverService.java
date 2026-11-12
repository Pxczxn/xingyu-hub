package top.pxczxn.xingyu.community.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.support.ArticleCoverSupport;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ContentCoverService {

    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;

    public String resolveCoverUrl(SearchDocument document) {
        if (document == null) {
            return null;
        }
        return resolveArticleCoverUrl(document.getObjectType(), document.getObjectId());
    }

    public String resolveArticleCoverUrl(String objectType, String objectId) {
        if (!"ARTICLE".equals(objectType) || objectId == null || objectId.isBlank()) {
            return null;
        }

        PublishedRevision published = publishedRevisionMapper.findByArticleId(objectId);
        if (published == null) {
            return null;
        }

        FormalRevision revision = formalRevisionMapper.selectById(published.getFormalRevisionId());
        if (revision == null) {
            return null;
        }

        if (revision.getCoverUrl() != null && !revision.getCoverUrl().isBlank()) {
            return revision.getCoverUrl();
        }

        return ArticleCoverSupport.extractCoverUrl(revision.getBody());
    }

    public Map<String, String> resolveDocumentCovers(Iterable<SearchDocument> documents) {
        List<String> articleIds = new ArrayList<>();
        if (documents != null) {
            for (SearchDocument document : documents) {
                if (document != null
                        && "ARTICLE".equals(document.getObjectType())
                        && document.getObjectId() != null
                        && !document.getObjectId().isBlank()
                        && !articleIds.contains(document.getObjectId())) {
                    articleIds.add(document.getObjectId());
                }
            }
        }
        if (articleIds.isEmpty()) {
            return Map.of();
        }
        return resolveArticleCovers(articleIds);
    }

    public Map<String, String> resolveArticleCovers(List<String> articleIds) {
        List<String> ids = articleIds.stream()
                .filter(articleId -> articleId != null && !articleId.isBlank())
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, PublishedRevision> publishedByArticle = new HashMap<>();
        for (PublishedRevision published : publishedRevisionMapper.listByArticleIds(ids)) {
            publishedByArticle.putIfAbsent(published.getArticleId(), published);
        }
        List<String> revisionIds = publishedByArticle.values().stream()
                .map(PublishedRevision::getFormalRevisionId)
                .filter(revisionId -> revisionId != null && !revisionId.isBlank())
                .distinct()
                .toList();
        Map<String, FormalRevision> revisions = new HashMap<>();
        if (!revisionIds.isEmpty()) {
            for (FormalRevision revision : formalRevisionMapper.listByIds(revisionIds)) {
                revisions.putIfAbsent(revision.getId(), revision);
            }
        }
        Map<String, String> covers = new HashMap<>();
        for (String articleId : ids) {
            PublishedRevision published = publishedByArticle.get(articleId);
            if (published == null) {
                continue;
            }
            FormalRevision revision = revisions.get(published.getFormalRevisionId());
            if (revision == null) {
                continue;
            }
            String cover = coverOf(revision);
            if (cover != null) {
                covers.put(articleId, cover);
            }
        }
        return covers;
    }

    private static String coverOf(FormalRevision revision) {
        if (revision.getCoverUrl() != null && !revision.getCoverUrl().isBlank()) {
            return revision.getCoverUrl();
        }
        return ArticleCoverSupport.extractCoverUrl(revision.getBody());
    }
}
