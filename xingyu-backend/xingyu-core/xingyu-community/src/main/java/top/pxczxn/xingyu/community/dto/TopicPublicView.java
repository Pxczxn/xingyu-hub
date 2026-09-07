package top.pxczxn.xingyu.community.dto;

import top.pxczxn.xingyu.community.entity.Topic;
import lombok.Builder;
import lombok.Value;

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

    public static TopicPublicView from(Topic topic) {
        return from(topic, null, null, null);
    }

    public static TopicPublicView from(
            Topic topic,
            Long followerCount,
            Long contentCount,
            Boolean following) {
        return TopicPublicView.builder()
                .id(topic.getId())
                .slug(topic.getSlug())
                .name(topic.getName())
                .description(topic.getDescription())
                .followerCount(followerCount)
                .contentCount(contentCount)
                .following(following)
                .build();
    }
}
