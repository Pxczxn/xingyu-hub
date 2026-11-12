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
    String coverUrl;
    String bodyMode;
    String body;
    String slug;
    String visibility;
    String categoryId;
    List<String> topicIds;
    long lockVersion;
    Instant updatedAt;
    Instant scheduledPublishAt;
    /** OWNER = 文章主人；EDITOR = 协作者。送审/回收站仍只有 OWNER。 */
    String collaborationRole;
}
