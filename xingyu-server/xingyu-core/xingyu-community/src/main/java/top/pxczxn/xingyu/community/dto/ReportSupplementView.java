package top.pxczxn.xingyu.community.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record ReportSupplementView(
        String id,
        String body,
        Instant createdAt) {
}
