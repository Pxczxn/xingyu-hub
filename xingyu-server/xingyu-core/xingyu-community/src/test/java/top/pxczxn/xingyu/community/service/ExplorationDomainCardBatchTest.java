package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.RecommendationFeedView;
import top.pxczxn.xingyu.community.entity.ExploreDomain;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ContentTagMapper;
import top.pxczxn.xingyu.community.mapper.ExploreDomainMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExplorationDomainCardBatchTest {

    private final ExploreDomainMapper domains = mock(ExploreDomainMapper.class);
    private final ContentTagMapper tags = mock(ContentTagMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final FeedService feeds = mock(FeedService.class);
    private final RecommendationService recommendations = mock(RecommendationService.class);
    private final ExplorationService service = new ExplorationService(
            domains, null, tags, null, documents, feeds, recommendations);

    @Test
    void domainFeedKeepsLiveTitlesAndPadsFromOneDocumentQuery() {
        ExploreDomain domain = new ExploreDomain();
        domain.setId("tech");
        when(domains.findSystemBySlug("tech")).thenReturn(domain);
        when(domains.listActiveChildrenByParentIds(List.of("tech"))).thenReturn(List.of());
        when(tags.listArticleIdsByDomains(List.of("tech"), 3))
                .thenReturn(List.of("first", "removed", "second"));
        when(documents.findLiveByTypeAndIds("ARTICLE", List.of("first", "removed", "second")))
                .thenReturn(List.of(document("first", "第一篇"), document("second", "第二篇")));
        when(recommendations.recommend(null, 3)).thenReturn(RecommendationFeedView.builder()
                .items(List.of(ContentCardView.builder().id("pad").title("推荐").objectType("ARTICLE").build()))
                .build());

        var cards = service.feedForDomain(null, "tech", "latest", 3);

        assertThat(cards).extracting("id").containsExactly("first", "second", "pad");
        assertThat(cards).extracting("title").containsExactly("第一篇", "第二篇", "推荐");
        verify(documents).findLiveByTypeAndIds("ARTICLE", List.of("first", "removed", "second"));
        verify(documents, never()).findByObject(any(), any());
        verify(recommendations).recommend(null, 3);
    }

    @Test
    void unknownDomainDoesNotQueryDocuments() {
        when(domains.findSystemBySlug("missing")).thenReturn(null);
        when(feeds.getFeed(null, "latest", 0, 3)).thenReturn(List.of());

        assertThat(service.feedForDomain(null, "missing", "latest", 3)).isEmpty();

        verify(documents, never()).findLiveByTypeAndIds(any(), any());
        verify(documents, never()).findByObject(any(), any());
    }

    private static SearchDocument document(String articleId, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType("ARTICLE");
        document.setObjectId(articleId);
        document.setTitle(title);
        return document;
    }
}
