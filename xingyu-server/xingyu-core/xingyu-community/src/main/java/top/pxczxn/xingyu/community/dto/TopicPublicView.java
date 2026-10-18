package top.pxczxn.xingyu.community.dto;

import top.pxczxn.xingyu.community.entity.Topic;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class TopicPublicView {
    String id;
    String slug;
    String name;
    String description;
    Long followerCount;
    Long contentCount;
    Boolean following;
    /**
     * 该话题下最新一篇公开文章的发布时间（{@code published_revision.published_at}）。
     *
     * <p>广场用它对「最近活跃」排序。没有公开文章的话题为 null —— 前端应当整块不渲染
     * 这一条，而不是显示「暂无更新」之类无法验证的文案。
     */
    Instant lastPublishedAt;

    public static TopicPublicView from(Topic topic) {
        return from(topic, null, null, null, null);
    }

    public static TopicPublicView from(
            Topic topic,
            Long followerCount,
            Long contentCount,
            Boolean following,
            Instant lastPublishedAt) {
        return TopicPublicView.builder()
                .id(topic.getId())
                .slug(topic.getSlug())
                .name(topic.getName())
                .description(topic.getDescription())
                .followerCount(followerCount)
                .contentCount(contentCount)
                .following(following)
                .lastPublishedAt(lastPublishedAt)
                .build();
    }
}
