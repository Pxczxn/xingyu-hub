package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.support.CommunityEventSupport;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SeriesChapterInsertBatchTest {

    private final SeriesMapper series = mock(SeriesMapper.class);
    private final SeriesChapterMapper chapters = mock(SeriesChapterMapper.class);
    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final CommunityEventSupport events = mock(CommunityEventSupport.class);
    private final SeriesService service = new SeriesService(
            null, series, null, chapters, articles, null, null, events, null, null);

    @Test
    void replacingChaptersInsertsTheNewOrderOnce() {
        when(series.selectById("series-1")).thenReturn(owned("series-1", "me"));
        when(series.update(isNull(), any())).thenReturn(1);
        when(articles.selectBatchIds(List.of("second", "first"))).thenReturn(List.of(
                article("first", "me"),
                article("second", "me")));
        when(chapters.listBySeriesId("series-1")).thenReturn(List.of());

        service.update(user("me"), "series-1", Map.of(
                "lockVersion", 0,
                "chapterArticleIds", List.of("second", "first")));

        verify(chapters).deleteBySeriesId("series-1");
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SeriesChapter>> saved = ArgumentCaptor.forClass(List.class);
        verify(chapters).insertAll(saved.capture());
        assertThat(saved.getValue()).extracting(SeriesChapter::getArticleId).containsExactly("second", "first");
        assertThat(saved.getValue()).extracting(SeriesChapter::getPosition).containsExactly(1, 2);
        assertThat(saved.getValue()).extracting(SeriesChapter::getSeriesId).containsExactly("series-1", "series-1");
        verify(chapters, never()).insert(any());
    }

    @Test
    void clearingChaptersDoesNotInsert() {
        when(series.selectById("series-1")).thenReturn(owned("series-1", "me"));
        when(series.update(isNull(), any())).thenReturn(1);
        when(chapters.listBySeriesId("series-1")).thenReturn(List.of());

        service.update(user("me"), "series-1", Map.of(
                "lockVersion", 0,
                "chapterArticleIds", List.of()));

        verify(chapters).deleteBySeriesId("series-1");
        verify(chapters, never()).insertAll(any());
        verify(chapters, never()).insert(any());
        verify(articles, never()).selectBatchIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Series owned(String id, String ownerId) {
        Series series = new Series();
        series.setId(id);
        series.setOwnerId(ownerId);
        series.setTitle("连载");
        series.setStatus("ACTIVE");
        series.setLockVersion(0L);
        return series;
    }

    private static Article article(String id, String ownerId) {
        Article article = new Article();
        article.setId(id);
        article.setOwnerId(ownerId);
        return article;
    }
}
