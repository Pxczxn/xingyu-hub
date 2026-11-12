package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.SeriesChapter;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SeriesChapterTitleBatchTest {

    private final SeriesMapper series = mock(SeriesMapper.class);
    private final SeriesChapterMapper chapters = mock(SeriesChapterMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final SearchDocumentMapper documents = mock(SearchDocumentMapper.class);
    private final WorkingDraftMapper drafts = mock(WorkingDraftMapper.class);
    private final SeriesService service = new SeriesService(
            null, series, null, chapters, null, profiles, documents, null, drafts, null);

    @Test
    void ownerViewPrefersIndexTitleAndFallsBackToOneDraftQuery() {
        when(series.selectById("series-1")).thenReturn(ownedSeries());
        when(chapters.listBySeriesId("series-1")).thenReturn(List.of(
                chapter("c1", "indexed", 1),
                chapter("c2", "draft-only", 2)));
        when(documents.listByTypeAndIds("ARTICLE", List.of("indexed", "draft-only")))
                .thenReturn(List.of(document("indexed", "索引标题")));
        when(drafts.listByArticleIds(List.of("draft-only"))).thenReturn(List.of(draft("draft-only", "草稿标题")));

        var view = service.getForOwner(user("owner"), "series-1");

        assertThat(view.getChapters()).extracting("title").containsExactly("索引标题", "草稿标题");
        verify(documents).listByTypeAndIds("ARTICLE", List.of("indexed", "draft-only"));
        verify(documents, never()).findByObject(any(), any());
        verify(drafts).listByArticleIds(List.of("draft-only"));
        verify(drafts, never()).findByArticleId(any());
    }

    @Test
    void publicViewKeepsRemovedIndexTitlesAndDoesNotReadDrafts() {
        when(series.selectById("series-1")).thenReturn(ownedSeries());
        when(profiles.findByUserId("owner")).thenReturn(profile());
        when(chapters.listBySeriesId("series-1")).thenReturn(List.of(
                chapter("c1", "removed", 1),
                chapter("c2", "unpublished", 2)));
        SearchDocument removed = document("removed", "下架标题");
        removed.setRemovedAt(Instant.parse("2026-10-30T00:00:00Z"));
        when(documents.listByTypeAndIds("ARTICLE", List.of("removed", "unpublished")))
                .thenReturn(List.of(removed));

        var view = service.getPublicById("series-1");

        assertThat(view.getChapters()).extracting("title").containsExactly("下架标题", null);
        verify(documents, never()).findByObject(any(), any());
        verify(drafts, never()).listByArticleIds(any());
        verify(drafts, never()).findByArticleId(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Series ownedSeries() {
        Series series = new Series();
        series.setId("series-1");
        series.setOwnerId("owner");
        series.setTitle("系列");
        series.setSlug("series");
        series.setStatus("ACTIVE");
        series.setLockVersion(0L);
        return series;
    }

    private static SeriesChapter chapter(String id, String articleId, int position) {
        SeriesChapter chapter = new SeriesChapter();
        chapter.setId(id);
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

    private static WorkingDraft draft(String articleId, String title) {
        WorkingDraft draft = new WorkingDraft();
        draft.setArticleId(articleId);
        draft.setTitle(title);
        return draft;
    }

    private static CommunityProfile profile() {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("owner");
        profile.setUsername("owner");
        profile.setDisplayName("作者");
        return profile;
    }
}
