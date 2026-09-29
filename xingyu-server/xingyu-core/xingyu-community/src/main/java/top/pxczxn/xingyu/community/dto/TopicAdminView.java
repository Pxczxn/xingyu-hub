package top.pxczxn.xingyu.community.dto;

import top.pxczxn.xingyu.community.entity.Topic;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class TopicAdminView {
    String id;
    String seedKey;
    String slug;
    String name;
    String description;
    String status;
    long followerCount;
    long contentCount;

    public static TopicAdminView from(Topic topic, long followerCount, long contentCount) {
        return TopicAdminView.builder()
                .id(topic.getId())
                .seedKey(topic.getSeedKey())
                .slug(topic.getSlug())
                .name(topic.getName())
                .description(topic.getDescription())
                .status(topic.getStatus())
                .followerCount(followerCount)
                .contentCount(contentCount)
                .build();
    }
}
