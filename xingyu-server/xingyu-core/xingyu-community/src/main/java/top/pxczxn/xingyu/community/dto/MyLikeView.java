package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class MyLikeView {
    String objectType;
    String objectId;
    String title;
    Instant createdAt;
}
