package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class FeaturedContentView {
    String id;
    String objectType;
    String objectId;
    String title;
    Integer sortOrder;
    String status;
    Instant createdAt;
}
