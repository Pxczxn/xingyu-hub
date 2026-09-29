package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class CommentView {
    String id;
    String authorId;
    String authorUsername;
    String parentId;
    String body;
    Instant createdAt;
}
