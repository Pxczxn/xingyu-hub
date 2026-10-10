package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;

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
    /**
     * 举报人历次补充说明，按真实 createdAt 升序 —— 管理员审阅时看到的补充信息
     * 必须与实际证据一致，不能只看到 report.detail 这一个初填字段。
     */
    List<ReportSupplementView> supplements;
}
