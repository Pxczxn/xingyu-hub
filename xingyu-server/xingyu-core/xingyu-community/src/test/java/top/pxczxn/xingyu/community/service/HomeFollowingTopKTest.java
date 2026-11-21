package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.NotificationMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.support.FollowedContentSupport;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HomeFollowingTopKTest {

    @Test
    void composeRequestsGlobalTopTenNotPerAuthorLimits() {
        NotificationMapper notifications = mock(NotificationMapper.class);
        SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
        ContentCoverService covers = mock(ContentCoverService.class);
        HomeService service = new HomeService(
                notifications, documents, follows, null, null, null, null, null, null, covers, enrichment, null, null);
        when(notifications.countUnread("me")).thenReturn(0L);

        List<String> followees = IntStream.range(0, 50).mapToObj(index -> "author-" + index).toList();
        Instant t = Instant.parse("2026-11-21T00:00:00Z");
        List<SearchDocument> articlePage = List.of(
                doc("ARTICLE", "prolific-new", t),
                doc("ARTICLE", "quiet-new", t.minusSeconds(1)));
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(followees);
        when(documents.listActiveByHot(null, 10)).thenReturn(List.of());
        when(documents.findLiveArticlesByOwnerIds(followees, 10)).thenReturn(articlePage);
        when(documents.findLiveSeriesByOwnerIds(followees, 10)).thenReturn(List.of(
                doc("SERIES", "series-1", t.minusSeconds(2))));
        when(documents.findRecentMomentsByAuthorIds(followees, 5)).thenReturn(List.of(
                doc("MOMENT", "moment-1", t.minusSeconds(3))));
        when(covers.resolveDocumentCovers(any())).thenReturn(Map.of());
        when(enrichment.enrich(any(), eq("me"))).thenReturn(Map.of());
        when(enrichment.applyViews(any(), any())).thenAnswer(invocation -> invocation.getArgument(0));

        var home = service.compose(user("me"));

        assertThat(home.getFollowingUpdates()).extracting("objectId")
                .containsExactly("prolific-new", "quiet-new", "series-1", "moment-1");
        verify(documents).findLiveArticlesByOwnerIds(followees, FollowedContentSupport.HOME_FOLLOW_LIMIT);
        verify(documents).findLiveSeriesByOwnerIds(followees, FollowedContentSupport.HOME_FOLLOW_LIMIT);
        verify(documents).findRecentMomentsByAuthorIds(followees, 5);
    }

    @Test
    void emptyFollowListSkipsContentQueries() {
        NotificationMapper notifications = mock(NotificationMapper.class);
        SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
        ContentCoverService covers = mock(ContentCoverService.class);
        HomeService service = new HomeService(
                notifications, documents, follows, null, null, null, null, null, null, covers, enrichment, null, null);
        when(notifications.countUnread("me")).thenReturn(0L);
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        when(documents.listActiveByHot(null, 10)).thenReturn(List.of());
        when(covers.resolveDocumentCovers(any())).thenReturn(Map.of());
        when(enrichment.enrich(any(), eq("me"))).thenReturn(Map.of());
        when(enrichment.applyViews(any(), any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.compose(user("me")).getFollowingUpdates()).isEmpty();
        verify(documents, never()).findLiveArticlesByOwnerIds(anyList(), eq(10));
        verify(documents, never()).findLiveSeriesByOwnerIds(anyList(), eq(10));
        verify(documents, never()).findRecentMomentsByAuthorIds(anyList(), eq(5));
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static SearchDocument doc(String type, String id, Instant indexedAt) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(type);
        document.setObjectId(id);
        document.setTitle(id);
        document.setIndexedAt(indexedAt);
        return document;
    }
}
