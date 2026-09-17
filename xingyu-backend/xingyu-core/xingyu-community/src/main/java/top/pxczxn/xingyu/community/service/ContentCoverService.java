package top.pxczxn.xingyu.community.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.support.ArticleCoverSupport;

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
}
