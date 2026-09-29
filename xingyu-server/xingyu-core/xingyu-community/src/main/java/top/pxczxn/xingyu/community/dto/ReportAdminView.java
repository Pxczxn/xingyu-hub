package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class ReportAdminView {
    String id;
    String reporterId;
    String objectType;
    String objectId;
    String reason;
    String detail;
    String status;
    String caseId;
    String caseStatus;
    Instant createdAt;
}
