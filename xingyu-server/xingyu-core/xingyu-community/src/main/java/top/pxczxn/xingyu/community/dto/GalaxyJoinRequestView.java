package top.pxczxn.xingyu.community.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record GalaxyJoinRequestView(
        String id,
        String galaxyId,
        String galaxySlug,
        String galaxyName,
        String message,
        String status,
        Instant createdAt) {
}
