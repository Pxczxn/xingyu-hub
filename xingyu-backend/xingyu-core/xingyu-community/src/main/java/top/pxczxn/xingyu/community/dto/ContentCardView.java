package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ContentCardView {
    String id;
    String objectType;
    String title;
    String summary;
    String authorName;
    Instant updatedAt;
}
