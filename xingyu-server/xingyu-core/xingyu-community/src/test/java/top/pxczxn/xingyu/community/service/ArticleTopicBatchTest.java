package top.pxczxn.xingyu.community.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.entity.ArticleTopic;
import top.pxczxn.xingyu.community.entity.Topic;
import top.pxczxn.xingyu.community.mapper.ArticleTopicMapper;
import top.pxczxn.xingyu.community.mapper.TopicMapper;

import java.io.Serializable;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArticleTopicBatchTest {

    private final ArticleTopicMapper links = mock(ArticleTopicMapper.class);
    private final TopicMapper topics = mock(TopicMapper.class);
    private final ArticleService service = new ArticleService(
            null, null, null, links, null, null, null, null, null, topics, null, null, null);

    @Test
    void savingTopicsLoadsOnceAndWritesSelectableIdsInOrder() {
        when(topics.selectBatchIds(List.of("tech", "art"))).thenReturn(List.of(
                topic("art", "art", "ENABLED"),
                topic("tech", "tech", "ACTIVE")));

        service.syncTopics("article-1", List.of("tech", "art"));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ArticleTopic>> saved = ArgumentCaptor.forClass(List.class);
        verify(links).deleteByArticleId("article-1");
        verify(links).insertAll(saved.capture());
        assertThat(saved.getValue()).extracting(ArticleTopic::getTopicId).containsExactly("tech", "art");
        assertThat(saved.getValue()).extracting(ArticleTopic::getArticleId).containsExactly("article-1", "article-1");
        verify(links, never()).insert(any());
        verify(topics, never()).selectById(any(Serializable.class));
    }

    @Test
    void missingOrDisabledTopicRejectsBeforeInsert() {
        when(topics.selectBatchIds(List.of("tech", "gone", "old", "art"))).thenReturn(List.of(
                topic("tech", "tech", "ACTIVE"),
                topic("old", "old", "ARCHIVED"),
                topic("art", "art", "ENABLED")));

        assertThatThrownBy(() -> service.syncTopics("article-1", List.of("tech", "gone", "old", "art")))
                .isInstanceOf(FieldContractException.class)
                .hasMessageContaining("话题不存在或未启用");
        verify(links).deleteByArticleId("article-1");
        verify(links, never()).insert(any());
        verify(links, never()).insertAll(any());
        verify(topics, never()).selectById(any(Serializable.class));
    }

    @Test
    void emptySelectionDoesNotQueryTopicsAndPublicSlugsLoadOnce() {
        service.syncTopics("article-1", List.of());

        verify(links).deleteByArticleId("article-1");
        verify(topics, never()).selectBatchIds(any());
        verify(topics, never()).selectById(any(Serializable.class));
        verify(links, never()).insert(any());
        verify(links, never()).insertAll(any());

        when(links.listByArticleId("article-1")).thenReturn(List.of(
                link("tech"),
                link("old"),
                link("art")));
        when(topics.selectBatchIds(List.of("tech", "old", "art"))).thenReturn(List.of(
                topic("art", "art-slug", "ENABLED"),
                topic("tech", "tech-slug", "ACTIVE"),
                topic("old", "old-slug", "ARCHIVED")));

        assertThat(service.listSelectableTopicSlugs("article-1")).containsExactly("tech-slug", "art-slug");
        verify(topics, never()).selectById(any(Serializable.class));
    }

    private static Topic topic(String id, String slug, String status) {
        Topic topic = new Topic();
        topic.setId(id);
        topic.setSlug(slug);
        topic.setStatus(status);
        return topic;
    }

    private static ArticleTopic link(String topicId) {
        ArticleTopic link = new ArticleTopic();
        link.setArticleId("article-1");
        link.setTopicId(topicId);
        return link;
    }
}
