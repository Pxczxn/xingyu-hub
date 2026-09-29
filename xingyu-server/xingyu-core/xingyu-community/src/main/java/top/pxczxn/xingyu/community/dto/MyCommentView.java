package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class MyCommentView {
    String id;
    String body;
    String objectType;
    String objectId;
    String objectTitle;
    Instant createdAt;
}
