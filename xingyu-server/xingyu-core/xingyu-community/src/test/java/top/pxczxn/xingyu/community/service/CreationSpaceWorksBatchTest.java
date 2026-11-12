package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.CommunityCreationSpace;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CreationSpaceCategory;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommunityCreationSpaceMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.CreationSpaceCategoryMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;

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

class CreationSpaceWorksBatchTest {

    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final CommunityCreationSpaceMapper spaces = mock(CommunityCreationSpaceMapper.class);
    private final CreationSpaceCategoryMapper categories = mock(CreationSpaceCategoryMapper.class);
    private final PublishedRevisionMapper published = mock(PublishedRevisionMapper.class);
    private final FormalRevisionMapper revisions = mock(FormalRevisionMapper.class);
    private final ArticleMapper articles = mock(ArticleMapper.class);
    private final EngagementMetricsService metrics = mock(EngagementMetricsService.class);
    private final CreationSpaceService service = new CreationSpaceService(
            profiles, null, spaces, categories, published, revisions, articles, metrics, mock(CommunityProfileService.class));

    @Test
    void publicWorksLoadArticlesRevisionsAndCategoriesOnce() {
        Instant earlier = Instant.parse("2026-10-01T00:00:00Z");
        Instant later = Instant.parse("2026-10-02T00:00:00Z");
        when(profiles.findByUsername("author")).thenReturn(profile());
        when(spaces.findByUserId("user-1")).thenReturn(space());
        when(categories.listBySpaceId("space-1")).thenReturn(List.of());
        when(published.listPublicBySpaceId("space-1", 10)).thenReturn(List.of(
                pointer("missing", "r-missing", earlier),
                pointer("private", "r-private", later),
                pointer("norev", "r-norev", later),
                pointer("essay", "r-essay", later),
                pointer("note", "r-note", earlier)));
        when(articles.selectBatchIds(List.of("missing", "private", "norev", "essay", "note"))).thenReturn(List.of(
                article("private", "cat-hidden"),
                article("norev", null),
                article("essay", "cat-1"),
                article("note", null)));
        when(revisions.selectBatchIds(List.of("r-missing", "r-private", "r-norev", "r-essay", "r-note"))).thenReturn(List.of(
                revision("r-private", "私密", "PRIVATE", null),
                revision("r-essay", "长文", "PUBLIC", "https://cover"),
                revision("r-note", "短记", "PUBLIC", null)));
        when(categories.selectBatchIds(List.of("cat-1"))).thenReturn(List.of(category("cat-1", "notes")));
        when(metrics.likeCounts(eq("ARTICLE"), any())).thenReturn(Map.of("essay", 2L));
        when(metrics.bookmarkCounts(eq("ARTICLE"), any())).thenReturn(Map.of());

        var works = service.getPublicWorks("author", null, null, 10).getWorks();

        assertThat(works).extracting("title").containsExactly("短记", "长文");
        assertThat(works).extracting("categorySlug").containsExactly(null, "notes");
        assertThat(works).extracting("coverUrl").containsExactly(null, "https://cover");
        assertThat(works).extracting("pinned").containsExactly(true, false);
        verify(articles, never()).selectById(any());
        verify(revisions, never()).selectById(any());
        verify(categories, never()).selectById(any());
    }

    @Test
    void emptyPublishedPageSkipsArticleRevisionAndCategoryReads() {
        when(profiles.findByUsername("author")).thenReturn(profile());
        when(spaces.findByUserId("user-1")).thenReturn(space());
        when(categories.listBySpaceId("space-1")).thenReturn(List.of());
        when(published.listPublicBySpaceId("space-1", 10)).thenReturn(List.of());

        assertThat(service.getPublicWorks("author", null, null, 10).getWorks()).isEmpty();

        verify(articles, never()).selectBatchIds(any());
        verify(revisions, never()).selectBatchIds(any());
        verify(categories, never()).selectBatchIds(any());
        verify(articles, never()).selectById(any());
        verify(revisions, never()).selectById(any());
        verify(categories, never()).selectById(any());
    }

    private static CommunityProfile profile() {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId("user-1");
        profile.setUsername("author");
        profile.setDisplayName("作者");
        return profile;
    }

    private static CommunityCreationSpace space() {
        CommunityCreationSpace space = new CommunityCreationSpace();
        space.setId("space-1");
        space.setUserId("user-1");
        space.setSlug("author");
        space.setPinnedArticleId("note");
        return space;
    }

    private static PublishedRevision pointer(String articleId, String revisionId, Instant publishedAt) {
        PublishedRevision pointer = new PublishedRevision();
        pointer.setArticleId(articleId);
        pointer.setFormalRevisionId(revisionId);
        pointer.setPublishedAt(publishedAt);
        return pointer;
    }

    private static Article article(String id, String categoryId) {
        Article article = new Article();
        article.setId(id);
        article.setCategoryId(categoryId);
        return article;
    }

    private static FormalRevision revision(String id, String title, String visibility, String coverUrl) {
        FormalRevision revision = new FormalRevision();
        revision.setId(id);
        revision.setTitle(title);
        revision.setVisibility(visibility);
        revision.setCoverUrl(coverUrl);
        return revision;
    }

    private static CreationSpaceCategory category(String id, String slug) {
        CreationSpaceCategory category = new CreationSpaceCategory();
        category.setId(id);
        category.setSlug(slug);
        return category;
    }
}
