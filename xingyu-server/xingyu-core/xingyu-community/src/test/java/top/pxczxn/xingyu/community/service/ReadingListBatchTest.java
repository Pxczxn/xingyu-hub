package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.entity.SeriesReaderState;
import top.pxczxn.xingyu.community.entity.SeriesSubscription;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.SeriesReaderStateMapper;
import top.pxczxn.xingyu.community.mapper.SeriesSubscriptionMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReadingListBatchTest {

    private final SeriesReaderStateMapper states = mock(SeriesReaderStateMapper.class);
    private final SeriesSubscriptionMapper subscriptions = mock(SeriesSubscriptionMapper.class);
    private final SeriesMapper series = mock(SeriesMapper.class);
    private final SeriesChapterMapper chapters = mock(SeriesChapterMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final PublishedRevisionMapper published = mock(PublishedRevisionMapper.class);
    private final FormalRevisionMapper revisions = mock(FormalRevisionMapper.class);
    private final ClientSettingsService settings = mock(ClientSettingsService.class);
    private final ReadingService service = new ReadingService(
            states,
            subscriptions,
            series,
            chapters,
            documents,
            null,
            settings,
            new ContentCoverService(published, revisions));

    @Test
    void continueReadingAndBookshelfUseOneBatchEach() {
        when(settings.isReadingHistoryEnabled(any())).thenReturn(true);
        when(states.listRecentByUser("me", 10)).thenReturn(List.of(
                progress("series-1", "chapter-2"),
                progress("missing-series", "loose-article")));
        when(series.listByIds(List.of("series-1", "missing-series"))).thenReturn(List.of(series("series-1", "连载")));
        when(chapters.listBySeriesIds(List.of("series-1"))).thenReturn(List.of(
                chapter("series-1", "chapter-1", 1),
                chapter("series-1", "chapter-2", 2)));
        when(documents.listByTypeAndIds("ARTICLE", List.of("chapter-2", "loose-article"))).thenReturn(List.of(
                document("chapter-2", "第二章"),
                document("loose-article", "散篇文章")));
        when(published.listByArticleIds(List.of("chapter-2", "loose-article")))
                .thenReturn(List.of(published("chapter-2", "revision-2")));
        when(revisions.listByIds(List.of("revision-2"))).thenReturn(List.of(revision("revision-2", "https://cover")));
        when(subscriptions.listByUserId("me", 20)).thenReturn(List.of(
                subscription("series-1"),
                subscription("gone")));
        when(series.listByIds(List.of("series-1", "gone"))).thenReturn(List.of(series("series-1", "连载")));

        var reading = service.continueReading(user("me"), 10);
        var shelf = service.bookshelf(user("me"), 20, null);

        assertThat(reading).extracting("id").containsExactly("series-1", "loose-article");
        assertThat(reading).extracting("objectType").containsExactly("SERIES", "ARTICLE");
        assertThat(reading).extracting("chapterIndex").containsExactly(2, null);
        assertThat(reading).extracting("chapterCount").containsExactly(2, null);
        assertThat(reading).extracting("chapterTitle").containsExactly("第二章", null);
        assertThat(reading).extracting("title").containsExactly("连载", "散篇文章");
        assertThat(reading).extracting("cover").containsExactly("https://cover", null);
        assertThat(shelf.getItems()).extracting("id").containsExactly("series-1");
        assertThat(shelf.getTotal()).isEqualTo(1L);
        verify(series).listByIds(List.of("series-1", "missing-series"));
        verify(series).listByIds(List.of("series-1", "gone"));
        verify(chapters).listBySeriesIds(List.of("series-1"));
        verify(documents).listByTypeAndIds("ARTICLE", List.of("chapter-2", "loose-article"));
        verify(published).listByArticleIds(List.of("chapter-2", "loose-article"));
        verify(revisions).listByIds(List.of("revision-2"));
        verify(series, never()).selectById(any());
        verify(chapters, never()).listBySeriesId(any());
        verify(documents, never()).findByObject(any(), any());
        verify(published, never()).findByArticleId(any());
        verify(revisions, never()).selectById(any());
    }

    @Test
    void disabledHistoryAndEmptyShelfDoNotQuerySeries() {
        when(settings.isReadingHistoryEnabled(any())).thenReturn(false);
        when(subscriptions.listByUserId("me", 20)).thenReturn(List.of());

        assertThat(service.continueReading(user("me"), 10)).isEmpty();
        assertThat(service.bookshelf(user("me"), 20, null).getItems()).isEmpty();

        verify(states, never()).listRecentByUser(any(), anyInt());
        verify(series, never()).listByIds(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static SeriesReaderState progress(String seriesId, String articleId) {
        SeriesReaderState state = new SeriesReaderState();
        state.setSeriesId(seriesId);
        state.setLastReadArticleId(articleId);
        state.setLastReadAt(Instant.parse("2026-10-30T12:00:00Z"));
        return state;
    }

    private static Series series(String id, String title) {
        Series series = new Series();
        series.setId(id);
        series.setTitle(title);
        series.setDescription(title);
        return series;
    }

    private static SeriesChapter chapter(String seriesId, String articleId, int position) {
        SeriesChapter chapter = new SeriesChapter();
        chapter.setSeriesId(seriesId);
        chapter.setArticleId(articleId);
        chapter.setPosition(position);
        return chapter;
    }

    private static SearchDocument document(String articleId, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType("ARTICLE");
        document.setObjectId(articleId);
        document.setTitle(title);
        return document;
    }

    private static PublishedRevision published(String articleId, String revisionId) {
        PublishedRevision published = new PublishedRevision();
        published.setArticleId(articleId);
        published.setFormalRevisionId(revisionId);
        return published;
    }

    private static FormalRevision revision(String id, String coverUrl) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
        revision.setCoverUrl(coverUrl);
        return revision;
    }

    private static SeriesSubscription subscription(String seriesId) {
        SeriesSubscription subscription = new SeriesSubscription();
        subscription.setSeriesId(seriesId);
        subscription.setCreatedAt(Instant.parse("2026-10-30T08:00:00Z"));
        return subscription;
    }
}
