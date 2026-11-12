package top.pxczxn.xingyu.community.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import top.pxczxn.xingyu.community.context.CommunityAuthContext;
import top.pxczxn.xingyu.community.dto.ObjectCountRow;
import top.pxczxn.xingyu.community.dto.TopicActivityStat;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.TopicFollowMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TopicSquareBatchTest {

    private final TopicMapper topics = mock(TopicMapper.class);
    private final TopicFollowMapper follows = mock(TopicFollowMapper.class);
    private final ArticleTopicMapper articleTopics = mock(ArticleTopicMapper.class);
    private final TopicService service = new TopicService(
            topics, null, follows, articleTopics, null, null, null, null, null);

    @AfterEach
    void clearUser() {
        CommunityAuthContext.clear();
    }

    @Test
    void squareLoadsCountsAndFollowingOnce() {
        Instant publishedAt = Instant.parse("2026-10-30T00:00:00Z");
        when(topics.selectList(any(Wrapper.class))).thenReturn(List.of(topic("tech", "技术"), topic("quiet", "安静")));
        when(articleTopics.listTopicActivity()).thenReturn(List.of(activity("tech", publishedAt)));
        when(follows.countByTopicIds(List.of("tech", "quiet"))).thenReturn(List.of(new ObjectCountRow("tech", 4)));
        when(articleTopics.countPublicContentByTopicIds(List.of("tech", "quiet")))
                .thenReturn(List.of(new ObjectCountRow("tech", 2)));
        CommunityAuthContext.set(user("me"), null);
        when(follows.listTopicIdsByUser("me", List.of("tech", "quiet"))).thenReturn(List.of("tech"));

        var listed = service.listPublicViews(null);

        assertThat(listed).extracting("slug").containsExactly("tech", "quiet");
        assertThat(listed).extracting("followerCount").containsExactly(4L, 0L);
        assertThat(listed).extracting("contentCount").containsExactly(2L, 0L);
        assertThat(listed).extracting("following").containsExactly(true, false);
        assertThat(listed).extracting("lastPublishedAt").containsExactly(publishedAt, null);
        verify(follows, never()).countByTopicId(any());
        verify(follows, never()).findByUserAndTopic(any(), any());
        verify(articleTopics, never()).countPublicContent(any());
    }

    @Test
    void guestFollowingStaysUnsetAndEmptySquareDoesNotCount() {
        when(topics.selectList(any(Wrapper.class))).thenReturn(
                List.of(topic("tech", "技术")),
                List.of());
        when(articleTopics.listTopicActivity()).thenReturn(List.of());
        when(follows.countByTopicIds(List.of("tech"))).thenReturn(List.of());
        when(articleTopics.countPublicContentByTopicIds(List.of("tech"))).thenReturn(List.of());

        var guest = service.listPublicViews(null);
        var empty = service.listPublicViews("missing");

        assertThat(guest).extracting("following").containsExactly((Boolean) null);
        assertThat(empty).isEmpty();
        verify(follows, never()).listTopicIdsByUser(any(), any());
        verify(follows).countByTopicIds(List.of("tech"));
        verify(follows, never()).countByTopicId(any());
    }

    private static CommunityUser user(String id) {
        CommunityUser user = new CommunityUser();
        user.setId(id);
        return user;
    }

    private static Topic topic(String slug, String name) {
        Topic topic = new Topic();
        topic.setId(slug);
        topic.setSlug(slug);
        topic.setName(name);
        topic.setStatus("ACTIVE");
        return topic;
    }

    private static TopicActivityStat activity(String topicId, Instant lastPublishedAt) {
        TopicActivityStat stat = new TopicActivityStat();
        stat.setTopicId(topicId);
        stat.setLastPublishedAt(lastPublishedAt);
        return stat;
    }
}
