package top.pxczxn.xingyu.community.dto;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * 管理端看到的申诉队列行。
 *
 * <p>词表同 {@link AppealDetailView}：PENDING / APPROVED / REJECTED，{@code outcome}
 * 显式给出终局结论。管理端额外可见 {@code decidedBy}（处理人）与
 * {@code decisionNote}（处理说明），用于追责与审计。
 */
@Value
@Builder
public class AppealAdminView {
    String id;
    String caseId;
    String appellantId;
    String body;
    String status;
    /** APPROVED / REJECTED；null = 尚未裁决。 */
    String outcome;
    String decidedBy;
    Instant decidedAt;
    String decisionNote;
    String measureId;
    Instant createdAt;
}
