package top.pxczxn.xingyu.community.dto;

import lombok.Builder;

import java.time.Instant;

/**
 * 星系内容推荐视图（Galaxy Content Contribution，V054）。
 *
 * <p>title/summary 现查活文档（search_document.removed_at IS NULL）；
 * 作品被下架后这两个字段为 null，前端按"内容不可用"降级展示，
 * 不能因为推荐记录还在就伪造标题。
 */
@Builder
public record GalaxyContentSubmissionView(
        String id,
        String galaxyId,
        String galaxySlug,
        String galaxyName,
        String objectType,
        String objectId,
        String title,
        String summary,
        String submitterId,
        String submitterName,
        String note,
        String status,
        String rejectReason,
        Instant createdAt,
        Instant resolvedAt) {
}
