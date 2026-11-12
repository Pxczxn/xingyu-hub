package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FollowingFeedBatchTest {

    private final UserFollowMapper follows = mock(UserFollowMapper.class);
    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final MomentMapper moments = mock(MomentMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final ContentCoverService covers = mock(ContentCoverService.class);
    private final FeedService service = new FeedService(
            follows, articles, moments, documents, null, covers);

    @Test
    void followingFeedLoadsContentDocumentsAndCoversOnce() {
        Instant earlier = Instant.parse("2026-10-01T00:00:00Z");
        Instant later = Instant.parse("2026-10-02T00:00:00Z");
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of("author", "quiet"));
        when(articles.listByOwnerIds(List.of("author", "quiet"))).thenReturn(List.of(
                article("trashed", "author", ArticleStateSupport.LIFECYCLE_TRASHED, later),
                article("essay", "author", ArticleStateSupport.LIFECYCLE_ACTIVE, later),
                article("hidden", "quiet", ArticleStateSupport.LIFECYCLE_ACTIVE, earlier)));
        when(moments.listRecentByAuthorIds(List.of("author", "quiet"), 10)).thenReturn(List.of(
                moment("published", "author", "PUBLISHED", later),
                moment("visible", "author", "VISIBLE", earlier)));
        when(documents.findLiveByTypeAndIds("ARTICLE", List.of("essay", "hidden")))
                .thenReturn(List.of(document("ARTICLE", "essay", "长文")));
        when(documents.findLiveByTypeAndIds("MOMENT", List.of("visible")))
                .thenReturn(List.of(document("MOMENT", "visible", "动态")));
        when(covers.resolveDocumentCovers(any())).thenReturn(Map.of("essay", "https://cover"));

        var listed = service.getFeed(user("me"), "following", 0, 1);

        assertThat(listed).extracting("id").containsExactly("essay");
        assertThat(listed).extracting("cover").containsExactly("https://cover");
        verify(articles, never()).listByOwnerId(any());
        verify(moments, never()).listByAuthorId(any(), eq(10));
        verify(documents, never()).findByObject(any(), any());
        verify(covers, never()).resolveCoverUrl(any());
    }

    @Test
    void emptyFollowListAndHotFeedSkipPerRowReads() {
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        assertThat(service.getFeed(user("me"), "following", 0, 20)).isEmpty();
        assertThat(service.getFeed(null, "following", 0, 20)).isEmpty();

        when(documents.listActiveByHot(null, 4)).thenReturn(List.of(
                document("SERIES", "series", "系列"),
                document("ARTICLE", "essay", "长文"),
                document("MOMENT", "moment", "动态")));
        when(covers.resolveDocumentCovers(any())).thenReturn(Map.of("essay", "https://cover"));

        var hot = service.getFeed(null, "hot", 0, 2);

        assertThat(hot).extracting("id").containsExactly("essay", "moment");
        assertThat(hot).extracting("cover").containsExactly("https://cover", null);
        verify(articles, never()).listByOwnerIds(any());
        verify(moments, never()).listRecentByAuthorIds(any(), eq(10));
        verify(covers, never()).resolveCoverUrl(any());
        verify(documents, never()).findByObject(any(), any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Article article(String id, String ownerId, String lifecycle, Instant updatedAt) {
        Article article = new Article();
        article.setId(id);
        article.setOwnerId(ownerId);
        article.setLifecycleStatus(lifecycle);
        article.setUpdatedAt(updatedAt);
        return article;
    }

    private static Moment moment(String id, String authorId, String status, Instant createdAt) {
        Moment moment = new Moment();
        moment.setId(id);
        moment.setAuthorId(authorId);
        moment.setStatus(status);
        moment.setCreatedAt(createdAt);
        return moment;
    }

    private static SearchDocument document(String type, String id, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType(type);
        document.setObjectId(id);
        document.setTitle(title);
        return document;
    }
}
