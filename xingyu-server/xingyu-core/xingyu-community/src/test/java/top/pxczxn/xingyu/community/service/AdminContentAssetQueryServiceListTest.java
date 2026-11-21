package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.metadata.IPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Series;
import top.pxczxn.xingyu.community.entity.WorkingDraft;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CommunityUserMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.mapper.SeriesChapterMapper;
import top.pxczxn.xingyu.community.mapper.SeriesMapper;
import top.pxczxn.xingyu.community.mapper.WorkingDraftMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminContentAssetQueryServiceListTest {

    private ArticleMapper articleMapper;
    private WorkingDraftMapper workingDraftMapper;
    private PublishedRevisionMapper publishedRevisionMapper;
    private FormalRevisionMapper formalRevisionMapper;
    private SeriesMapper seriesMapper;
    private SeriesChapterMapper seriesChapterMapper;
    private CommunityProfileMapper profileMapper;
    private CommunityUserMapper userMapper;
    private AdminContentAssetQueryService service;

    @BeforeEach
    void setUp() {
        articleMapper = mock(ArticleMapper.class);
        workingDraftMapper = mock(WorkingDraftMapper.class);
        publishedRevisionMapper = mock(PublishedRevisionMapper.class);
        formalRevisionMapper = mock(FormalRevisionMapper.class);
        seriesMapper = mock(SeriesMapper.class);
        seriesChapterMapper = mock(SeriesChapterMapper.class);
        profileMapper = mock(CommunityProfileMapper.class);
        userMapper = mock(CommunityUserMapper.class);
        service = new AdminContentAssetQueryService(
                seriesMapper,
                seriesChapterMapper,
                articleMapper,
                workingDraftMapper,
                publishedRevisionMapper,
                formalRevisionMapper,
                mock(MomentMapper.class),
                mock(MomentRevisionMapper.class),
                profileMapper,
                userMapper);
    }

    @Test
    void articlePageDoesNotGrowQueriesWithPageSizeAndOmitsBody() {
        Article first = article("a1", "owner-1");
        Article second = article("a2", "owner-1");
        stubArticlePage(List.of(first, second), 5);
        when(workingDraftMapper.listByArticleIds(List.of("a1", "a2"))).thenReturn(List.of(
                draft("a1", "标题一", "摘要一", "超长正文一"),
                draft("a2", "标题二", "摘要二", "超长正文二")));
        when(publishedRevisionMapper.listByArticleIds(List.of("a1", "a2"))).thenReturn(List.of(
                published("a1", "fr-1")));
        FormalRevision formal = new FormalRevision();
        formal.setId("fr-1");
        formal.setVisibility("PUBLIC");
        when(formalRevisionMapper.listByIds(List.of("fr-1"))).thenReturn(List.of(formal));
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("owner-1");
        profile.setDisplayName("作者");
        profile.setUsername("author");
        when(profileMapper.findByUserIds(List.of("owner-1"))).thenReturn(List.of(profile));
        CommunityUser user = new CommunityUser();
        user.setId("owner-1");
        user.setEmail("author@example.com");
        when(userMapper.selectBatchIds(List.of("owner-1"))).thenReturn(List.of(user));

        Map<String, Object> page = service.list("ARTICLE", null, "PUBLISHED", 1, 2);

        assertEquals(5L, page.get("total"));
        assertEquals(1, page.get("page"));
        assertEquals(2, page.get("pageSize"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) page.get("records");
        assertEquals(2, records.size());
        assertEquals("标题一", records.get(0).get("title"));
        assertEquals("摘要一", records.get(0).get("summary"));
        assertFalse(records.get(0).containsKey("body"));
        assertFalse(records.get(1).containsKey("body"));
        assertEquals("owner-1", records.get(0).get("authorId"));
        assertEquals("owner-1", records.get(1).get("authorId"));
        assertEquals(true, records.get(0).get("hasPublishedRevision"));
        assertEquals(false, records.get(1).get("hasPublishedRevision"));

        verify(workingDraftMapper, times(1)).listByArticleIds(anyList());
        verify(publishedRevisionMapper, times(1)).listByArticleIds(anyList());
        verify(formalRevisionMapper, times(1)).listByIds(anyList());
        verify(profileMapper, times(1)).findByUserIds(anyList());
        verify(userMapper, times(1)).selectBatchIds(anyList());
        verify(profileMapper, never()).findByUserId(any());
        verify(workingDraftMapper, never()).findByArticleId(any());
        verify(publishedRevisionMapper, never()).findByArticleId(any());
        verify(articleMapper, never()).selectList(any());
    }

    @Test
    void emptyArticlePageSkipsBatchInQueries() {
        stubArticlePage(List.of(), 0);

        Map<String, Object> page = service.list("ARTICLE", null, null, 1, 20);

        assertEquals(0L, page.get("total"));
        assertEquals(List.of(), page.get("records"));
        verify(workingDraftMapper, never()).listByArticleIds(anyList());
        verify(profileMapper, never()).findByUserIds(anyList());
        verify(userMapper, never()).selectBatchIds(any());
    }

    @Test
    void seriesChapterCountsUseGroupByAndMissingAuthorIsOmitted() {
        Series withChapters = series("s1", "owner-s");
        Series empty = series("s2", null);
        when(seriesMapper.pageForAdmin(any(), eq("ACTIVE"), isNull())).thenAnswer(invocation -> {
            IPage<Series> page = invocation.getArgument(0);
            page.setRecords(List.of(withChapters, empty));
            page.setTotal(2);
            return page;
        });
        when(seriesChapterMapper.countBySeriesIds(List.of("s1", "s2"))).thenReturn(List.of(
                new ObjectCountRow("s1", 3)));
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("owner-s");
        profile.setUsername("series-owner");
        when(profileMapper.findByUserIds(List.of("owner-s"))).thenReturn(List.of(profile));
        when(userMapper.selectBatchIds(List.of("owner-s"))).thenReturn(List.of());

        Map<String, Object> page = service.list("SERIES", null, "ACTIVE", 1, 20);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> records = (List<Map<String, Object>>) page.get("records");
        assertEquals(3, records.get(0).get("chapterCount"));
        assertEquals(0, records.get(1).get("chapterCount"));
        assertFalse(records.get(1).containsKey("authorId"));
        verify(seriesChapterMapper, times(1)).countBySeriesIds(anyList());
        verify(seriesChapterMapper, never()).listBySeriesId(any());
    }

    @Test
    void unknownTypeReturnsNull() {
        assertNull(service.list("TOPIC", null, null, 1, 20));
    }

    private void stubArticlePage(List<Article> records, long total) {
        when(articleMapper.pageForAdmin(any(), eq("PUBLISHED"), isNull())).thenAnswer(invocation -> fill(invocation.getArgument(0), records, total));
        when(articleMapper.pageForAdmin(any(), isNull(), isNull())).thenAnswer(invocation -> fill(invocation.getArgument(0), records, total));
    }

    private static IPage<Article> fill(IPage<Article> page, List<Article> records, long total) {
        page.setRecords(records);
        page.setTotal(total);
        return page;
    }

    private static Article article(String id, String ownerId) {
        Article article = new Article();
        article.setId(id);
        article.setOwnerId(ownerId);
        article.setStatus("PUBLISHED");
        article.setLifecycleStatus("ACTIVE");
        article.setModerationStatus("NORMAL");
        article.setUpdatedAt(Instant.parse("2026-11-21T12:00:00Z"));
        return article;
    }

    private static WorkingDraft draft(String articleId, String title, String summary, String body) {
        WorkingDraft draft = new WorkingDraft();
        draft.setArticleId(articleId);
        draft.setTitle(title);
        draft.setSummary(summary);
        draft.setBody(body);
        return draft;
    }

    private static PublishedRevision published(String articleId, String formalId) {
        PublishedRevision published = new PublishedRevision();
        published.setArticleId(articleId);
        published.setFormalRevisionId(formalId);
        return published;
    }

    private static Series series(String id, String ownerId) {
        Series series = new Series();
        series.setId(id);
        series.setOwnerId(ownerId);
        series.setTitle("系列");
        series.setStatus("ACTIVE");
        series.setUpdatedAt(Instant.parse("2026-11-21T12:00:00Z"));
        return series;
    }
}
