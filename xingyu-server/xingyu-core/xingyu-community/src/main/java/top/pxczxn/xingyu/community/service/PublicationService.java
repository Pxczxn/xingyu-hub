package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.ReviewSubmission;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;
import top.pxczxn.xingyu.community.support.TokenSupport;
import top.pxczxn.xingyu.file.service.SysFileService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PublicationService {

    private final ArticleMapper articleMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final CommunityEventSupport eventSupport;
    private final SysFileService fileService;
    private final SearchIndexService searchIndexService;

    @Transactional
    public PublishedRevision publishApprovedRevision(ReviewSubmission submission) {
        String eventId = "publication:" + submission.getId();
        PublishedRevision existing = publishedRevisionMapper.findByPublicationEventId(eventId);
        if (existing != null) {
            return existing;
        }

        FormalRevision revision = formalRevisionMapper.selectById(submission.getFormalRevisionId());
        if (revision == null) {
            throw new IllegalStateException("Formal revision missing for submission " + submission.getId());
        }

        Article article = articleMapper.selectById(submission.getArticleId());
        String ownerId = article == null ? null : article.getOwnerId();
        if (StringUtils.hasText(ownerId)) {
            String promotedBody = fileService.promotePrivateMediaInText(revision.getBody(), ownerId);
            String promotedCover = fileService.promotePrivateMediaUrl(revision.getCoverUrl(), ownerId);
            boolean changed = !java.util.Objects.equals(promotedBody, revision.getBody())
                    || !java.util.Objects.equals(promotedCover, revision.getCoverUrl());
            if (changed) {
                revision.setBody(promotedBody);
                revision.setCoverUrl(promotedCover);
                formalRevisionMapper.updateById(revision);
            }
        }

        Instant now = Instant.now();
        PublishedRevision published = publishedRevisionMapper.findByArticleId(submission.getArticleId());
        if (published == null) {
            published = new PublishedRevision();
            published.setId(TokenSupport.newId());
            published.setArticleId(submission.getArticleId());
            published.setFormalRevisionId(revision.getId());
            published.setPublishedAt(now);
            published.setPublicationEventId(eventId);
            publishedRevisionMapper.insert(published);
        } else {
            published.setFormalRevisionId(revision.getId());
            published.setPublishedAt(now);
            published.setPublicationEventId(eventId);
            publishedRevisionMapper.updateById(published);
        }

        if (article != null) {
            article.setStatus(ArticleStateSupport.EDITORIAL_PUBLISHED);
            article.setUpdatedAt(now);
            articleMapper.updateById(article);
        }

        eventSupport.publishArticleEvent(
                eventId,
                CommunityEventSupport.PUBLICATION_SUCCEEDED,
                submission.getArticleId());

        // The pointer just moved to a revision that may be PRIVATE (or different content).
        // The event above is consumed asynchronously (default 5s poll), so without this the
        // search index would keep serving the previous public title/summary to readers while
        // the detail route already denies it — an information leak, not merely stale content.
        // Refreshing inside the same transaction keeps the index and the pointer atomic.
        searchIndexService.refresh(SearchIndexService.ARTICLE, submission.getArticleId());

        return published;
    }
}
