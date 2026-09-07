package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class SeriesSummaryView {
    String id;
    String title;
    String slug;
    String description;
    String status;
    int chapterCount;
    Instant updatedAt;
}
