package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ReviewQueueItemView {
    String submissionId;
    String articleId;
    String formalRevisionId;
    String title;
    String submittedBy;
    String authorId;
    String authorDisplayName;
    String authorUsername;
    String authorLabel;
    String summary;
    String body;
    Instant submittedAt;
}
