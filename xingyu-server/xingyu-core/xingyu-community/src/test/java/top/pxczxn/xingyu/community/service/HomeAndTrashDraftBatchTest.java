package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.RecommendationFeedView;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ContentTrash;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.ContentTrashMapper;
import top.pxczxn.xingyu.community.mapper.UserFollowMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HomeAndTrashDraftBatchTest {

    @Test
    void homeDraftRailUsesOneDraftQuery() {
        ArticleMapper articles = mock(ArticleMapper.class);
        WorkingDraftMapper drafts = mock(WorkingDraftMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        ReadingService reading = mock(ReadingService.class);
        RecommendationService recommendations = mock(RecommendationService.class);
        HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
        HomeService service = new HomeService(
                null, null, follows, articles, drafts, null, null, reading, recommendations,
                null, enrichment, null, null);
        when(reading.continueReading(any(), eq(10))).thenReturn(List.of());
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        when(recommendations.recommend(any(), eq(12)))
                .thenReturn(RecommendationFeedView.builder().items(List.of()).build());
        when(enrichment.enrich(any(), eq("me"))).thenReturn(Map.of());
        when(enrichment.applyCards(any(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(articles.listRecentActiveDrafts("me", 6)).thenReturn(List.of(
                article("named", "DRAFT"),
                article("blank", "DRAFT")));
        when(articles.listActiveInReviewIds("me")).thenReturn(List.of());
        when(drafts.listByArticleIds(List.of("named", "blank")))
                .thenReturn(List.of(draft("named", "有标题")));

        var home = service.composeForMe(user("me"));

        assertThat(home.getDraftArticles()).extracting("id").containsExactly("named", "blank");
        assertThat(home.getDraftArticles()).extracting("title").containsExactly("有标题", "未命名草稿");
        assertThat(home.getPendingActions()).isEmpty();
        verify(drafts).listByArticleIds(List.of("named", "blank"));
        verify(drafts, never()).findByArticleId(any());
        verify(articles, never()).listByOwnerId(any());
    }

    @Test
    void homePendingActionsMatchEachArticleUnderReview() {
        ArticleMapper articles = mock(ArticleMapper.class);
        UserFollowMapper follows = mock(UserFollowMapper.class);
        ReadingService reading = mock(ReadingService.class);
        RecommendationService recommendations = mock(RecommendationService.class);
        HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
        HomeService service = new HomeService(
                null, null, follows, articles, null, null, null, reading, recommendations,
                null, enrichment, null, null);
        when(reading.continueReading(any(), eq(10))).thenReturn(List.of());
        when(follows.listFolloweeIdsByFollower("me")).thenReturn(List.of());
        when(recommendations.recommend(any(), eq(12)))
                .thenReturn(RecommendationFeedView.builder().items(List.of()).build());
        when(enrichment.enrich(any(), eq("me"))).thenReturn(Map.of());
        when(enrichment.applyCards(any(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(articles.listRecentActiveDrafts("me", 6)).thenReturn(List.of());
        when(articles.listActiveInReviewIds("me")).thenReturn(List.of("review-1", "review-2"));

        var home = service.composeForMe(user("me"));

        assertThat(home.getPendingActions()).extracting("type").containsExactly("REVIEW", "REVIEW");
        assertThat(home.getPendingActions()).extracting("title").containsExactly("文章审核中", "文章审核中");
        assertThat(home.getPendingActions()).extracting("href").containsExactly("/studio/reviewing", "/studio/reviewing");
        verify(articles, never()).listByOwnerId(any());
    }

    @Test
    void trashListUsesOneDraftQuery() {
        ContentTrashMapper trash = mock(ContentTrashMapper.class);
        WorkingDraftMapper drafts = mock(WorkingDraftMapper.class);
        TrashService service = new TrashService(null, null, trash, drafts, null, null);
        when(trash.listByOwnerId("me")).thenReturn(List.of(
                row("ARTICLE", "article-1"),
                row("SERIES", "series-1")));
        when(drafts.listByArticleIds(List.of("article-1"))).thenReturn(List.of(draft("article-1", "回收稿")));

        var listed = service.listForOwner(user("me"));

        assertThat(listed).extracting("objectId").containsExactly("article-1", "series-1");
        assertThat(listed).extracting("title").containsExactly("回收稿", null);
        verify(drafts).listByArticleIds(List.of("article-1"));
        verify(drafts, never()).findByArticleId(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Article article(String id, String status) {
        Article article = new Article();
        article.setId(id);
        article.setStatus(status);
        article.setLifecycleStatus("ACTIVE");
        return article;
    }

    private static WorkingDraft draft(String articleId, String title) {
        WorkingDraft draft = new WorkingDraft();
        draft.setArticleId(articleId);
        draft.setTitle(title);
        return draft;
    }

    private static ContentTrash row(String type, String objectId) {
        ContentTrash row = new ContentTrash();
        row.setObjectType(type);
        row.setObjectId(objectId);
        return row;
    }
}
