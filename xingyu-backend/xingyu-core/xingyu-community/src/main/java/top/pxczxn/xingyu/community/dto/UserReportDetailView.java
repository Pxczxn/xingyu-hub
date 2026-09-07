package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class UserReportDetailView {
    String id;
    String status;
    String targetType;
    String targetId;
    String reason;
    String detail;
    Instant createdAt;
    Instant updatedAt;
    String caseId;
    String caseStatus;
    String measureId;
}
