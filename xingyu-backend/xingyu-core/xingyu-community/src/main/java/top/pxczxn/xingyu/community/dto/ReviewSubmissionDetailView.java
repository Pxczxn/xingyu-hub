package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ReviewSubmissionDetailView {
    String id;
    String articleId;
    String title;
    String status;
    Instant submittedAt;
    String decision;
    String decisionComment;
}
