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
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class PublicationService {

    private final ArticleMapper articleMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final CommunityEventSupport eventSupport;

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

        Article article = articleMapper.selectById(submission.getArticleId());
        if (article != null) {
            article.setStatus(ArticleStateSupport.EDITORIAL_PUBLISHED);
            article.setUpdatedAt(now);
            articleMapper.updateById(article);
        }

        eventSupport.publishArticleEvent(
                eventId,
                CommunityEventSupport.PUBLICATION_SUCCEEDED,
                submission.getArticleId());

        return published;
    }
}
