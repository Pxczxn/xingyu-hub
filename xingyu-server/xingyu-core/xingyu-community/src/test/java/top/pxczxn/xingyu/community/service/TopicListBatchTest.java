package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.community.dto.ContentCardView;
import top.pxczxn.xingyu.community.dto.TopicOwnerStat;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TopicListBatchTest {

    private final TopicMapper topics = mock(TopicMapper.class);
    private final ArticleTopicMapper articleTopics = mock(ArticleTopicMapper.class);
    private final CommunityProfileMapper profiles = mock(CommunityProfileMapper.class);
    private final HomeFeedEnrichmentService enrichment = mock(HomeFeedEnrichmentService.class);
    private final ContentCoverService covers = mock(ContentCoverService.class);
    private final TopicService service = new TopicService(
            topics, null, null, articleTopics, profiles, null, null, enrichment, covers);

    @Test
    void contentCoversAndCreatorProfilesLoadOnce() {
        when(topics.findBySlug("tech")).thenReturn(topic("topic-1"));
        when(articleTopics.listLatestContent("topic-1", 2)).thenReturn(List.of(
                document("a1", "第一篇"),
                document("a2", "第二篇")));
        when(covers.resolveArticleCovers(List.of("a1", "a2"))).thenReturn(Map.of("a1", "https://cover"));
        when(enrichment.enrich(anyList(), isNull())).thenReturn(Map.of());
        when(enrichment.applyCards(anyList(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(articleTopics.listTopOwners("topic-1", 2)).thenReturn(List.of(owner("author-a", 3), owner("gone", 1)));
        when(profiles.findByUserIds(List.of("author-a", "gone"))).thenReturn(List.of(profile("author-a", "甲", "作者甲")));

        var cards = service.listContent("tech", "latest", 2);
        var creators = service.listCreators("tech", 2);

        assertThat(cards).extracting("title").containsExactly("第一篇", "第二篇");
        assertThat(cards).extracting("cover").containsExactly("https://cover", null);
        assertThat(cards).extracting("authorName").containsOnlyNulls();
        assertThat(creators).extracting("username").containsExactly("甲", "gone");
        assertThat(creators).extracting("displayName").containsExactly("作者甲", null);
        assertThat(creators).extracting("contentCount").containsExactly(3L, 1L);
        verify(covers, never()).resolveCoverUrl(any());
        verify(covers, never()).resolveArticleCoverUrl(any(), any());
        verify(profiles, never()).findByUserId(any());
        ArgumentCaptor<List<ContentCardView>> passed = ArgumentCaptor.forClass(List.class);
        verify(enrichment).applyCards(passed.capture(), any());
        assertThat(passed.getValue()).extracting("id").containsExactly("a1", "a2");
    }

    @Test
    void emptyTopicListsDoNotQueryCoversOrProfiles() {
        when(topics.findBySlug("tech")).thenReturn(topic("topic-1"));
        when(articleTopics.listLatestContent("topic-1", 12)).thenReturn(List.of());
        when(enrichment.enrich(anyList(), isNull())).thenReturn(Map.of());
        when(enrichment.applyCards(anyList(), any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(articleTopics.listTopOwners("topic-1", 12)).thenReturn(List.of());

        assertThat(service.listContent("tech", "latest", 0)).isEmpty();
        assertThat(service.listCreators("tech", 0)).isEmpty();

        verify(covers, never()).resolveArticleCovers(any());
        verify(profiles, never()).findByUserIds(any());
    }

    private static Topic topic(String id) {
        Topic topic = new Topic();
        topic.setId(id);
        topic.setStatus("ACTIVE");
        return topic;
    }

    private static SearchDocument document(String id, String title) {
        SearchDocument document = new SearchDocument();
        document.setObjectType("ARTICLE");
        document.setObjectId(id);
        document.setTitle(title);
        return document;
    }

    private static TopicOwnerStat owner(String ownerId, long contentCount) {
        TopicOwnerStat stat = new TopicOwnerStat();
        stat.setOwnerId(ownerId);
        stat.setContentCount(contentCount);
        return stat;
    }

    private static CommunityProfile profile(String userId, String username, String displayName) {
        CommunityProfile profile = new CommunityProfile();
        profile.setUserId(userId);
        profile.setUsername(username);
        profile.setDisplayName(displayName);
        return profile;
    }
}
