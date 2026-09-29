package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

@Value
@Builder
public class ArticleSummaryView {
    String id;
    String status;
    String lifecycleStatus;
    String moderationStatus;
    String title;
    String categoryId;
    Instant updatedAt;
}
