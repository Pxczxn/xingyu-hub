package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.ContentLikeMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.support.ArticleStateSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MeEngagementInsightsTest {

    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final UserFollowMapper follows = mock(UserFollowMapper.class);
    private final CommentMapper comments = mock(CommentMapper.class);
    private final ContentLikeMapper likes = mock(ContentLikeMapper.class);
    private final MeEngagementService service = new MeEngagementService(
            articles, follows, comments, likes, null, null);

    @Test
    void insightsCountPublishedDraftsAndReactionsOnOwnedContent() {
        when(articles.countByOwnerAndStatus("me", ArticleStateSupport.EDITORIAL_PUBLISHED)).thenReturn(3L);
        when(articles.countByOwnerAndStatus("me", ArticleStateSupport.EDITORIAL_DRAFT)).thenReturn(2L);
        when(follows.countFollowers("me")).thenReturn(4L);
        when(follows.countFollowing("me")).thenReturn(5L);
        when(comments.countVisibleOnOwnedContent("me")).thenReturn(7L);
        when(likes.countReceivedByOwner("me")).thenReturn(9L);

        var insights = service.insights(user("me"));

        assertThat(insights.articleCount()).isEqualTo(3L);
        assertThat(insights.draftCount()).isEqualTo(2L);
        assertThat(insights.followerCount()).isEqualTo(4L);
        assertThat(insights.followingCount()).isEqualTo(5L);
        assertThat(insights.commentCount()).isEqualTo(7L);
        assertThat(insights.likeCount()).isEqualTo(9L);
        verify(articles, never()).listByOwnerId(any());
        verify(comments, never()).countByAuthorId(any());
        verify(likes, never()).countByUserId(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }
}
