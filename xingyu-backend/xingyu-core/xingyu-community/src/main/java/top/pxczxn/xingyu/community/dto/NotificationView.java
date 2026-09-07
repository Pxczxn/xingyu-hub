package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class NotificationView {
    String id;
    String category;
    String title;
    String body;
    boolean read;
    Instant createdAt;
}
