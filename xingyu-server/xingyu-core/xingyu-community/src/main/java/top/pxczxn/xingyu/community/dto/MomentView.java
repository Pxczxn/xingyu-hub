package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class MomentView {
    String id;
    String body;
    String authorId;
    Instant createdAt;
}
