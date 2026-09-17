package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class FeedItemDTO {
    String id;
    String type;
    String title;
    String summary;
    String cover;
    String authorId;
    Instant createdAt;
}
