package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.FeaturedContentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RecommendationFollowTopKTest {

    @Test
    void followBasedCardsPassCallerLimitToArticleAndSeriesQueries() {
        ClientSettingsService settings = mock(ClientSettingsService.class);
        FeaturedContentMapper featured = mock(FeaturedContentMapper.class);
        SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        ContentCoverService covers = mock(ContentCoverService.class);
        RecommendationService service = new RecommendationService(
                settings, featured, documents, follows, null, null, null, covers);

        CommunityUser user = new CommunityUser();
        user.setId("me");
        List<String> followees = List.of("busy", "quiet");
        Instant t = Instant.parse("2026-11-21T00:00:00Z");
        when(settings.getSettings(user)).thenReturn(Map.of());
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(followees);
        when(documents.findLiveArticlesByOwnerIds(followees, 7)).thenReturn(List.of(
                doc("ARTICLE", "busy-new", t),
                doc("ARTICLE", "quiet-new", t.minusSeconds(2))));
        when(documents.findLiveSeriesByOwnerIds(followees, 7)).thenReturn(List.of(
                doc("SERIES", "busy-series", t.minusSeconds(1))));
        when(documents.findRecentMomentsByAuthorIds(followees, 3)).thenReturn(List.of(
                doc("MOMENT", "quiet-moment", t.minusSeconds(3))));
        when(covers.resolveArticleCovers(anyList())).thenReturn(Map.of());
        when(featured.listActive(anyInt())).thenReturn(List.of());
        when(documents.listActiveByHot(null, 14)).thenReturn(List.of());

        var feed = service.recommend(user, 7);

        assertThat(feed.getItems()).extracting("id")
                .containsExactly("busy-new", "busy-series", "quiet-new", "quiet-moment");
        verify(documents).findLiveArticlesByOwnerIds(followees, 7);
        verify(documents).findLiveSeriesByOwnerIds(followees, 7);
        verify(documents).findRecentMomentsByAuthorIds(followees, 3);
    }

    @Test
    void noFolloweesSkipLiveOwnerQueries() {
        ClientSettingsService settings = mock(ClientSettingsService.class);
        FeaturedContentMapper featured = mock(FeaturedContentMapper.class);
        SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        ContentCoverService covers = mock(ContentCoverService.class);
        RecommendationService service = new RecommendationService(
                settings, featured, documents, follows, null, null, null, covers);
        CommunityUser user = new CommunityUser();
        user.setId("me");
        when(settings.getSettings(user)).thenReturn(Map.of());
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        when(featured.listActive(12)).thenReturn(List.of());
        when(documents.listActiveByHot(null, 24)).thenReturn(List.of());
        when(covers.resolveArticleCovers(anyList())).thenReturn(Map.of());

        assertThat(service.recommend(user, 12).getItems()).isEmpty();
        verify(documents, never()).findLiveArticlesByOwnerIds(anyList(), anyInt());
        verify(documents, never()).findLiveSeriesByOwnerIds(anyList(), anyInt());
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
