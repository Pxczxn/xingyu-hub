package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class WorkingDraftView {
    String articleId;
    String title;
    String summary;
    String bodyMode;
    String body;
    String slug;
    String visibility;
    String categoryId;
    List<String> topicIds;
    long lockVersion;
    Instant updatedAt;
    Instant scheduledPublishAt;
}
