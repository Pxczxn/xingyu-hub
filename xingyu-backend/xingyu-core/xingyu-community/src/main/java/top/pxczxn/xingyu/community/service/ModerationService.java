package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.AppealAdminView;
import top.pxczxn.xingyu.community.dto.AppealDetailView;
import top.pxczxn.xingyu.community.dto.ModerationCaseView;
import top.pxczxn.xingyu.community.dto.ReportAdminView;
import top.pxczxn.xingyu.community.dto.ReportSupplementView;
import top.pxczxn.xingyu.community.dto.UserReportDetailView;
import top.pxczxn.xingyu.community.dto.UserReportView;
import top.pxczxn.xingyu.community.entity.Appeal;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import top.pxczxn.xingyu.community.entity.ModerationDecision;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.entity.ReportSupplement;
import top.pxczxn.xingyu.community.mapper.AppealMapper;
import top.pxczxn.xingyu.community.mapper.ModerationCaseMapper;
import top.pxczxn.xingyu.community.mapper.ModerationDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.mapper.ReportMapper;
import top.pxczxn.xingyu.community.mapper.ReportSupplementMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ModerationService {

    private static final Set<String> OPEN_CASE_STATUSES = Set.of("OPEN", "TRIAGED", "INVESTIGATING");

    private final ReportMapper reportMapper;
    private final ReportSupplementMapper reportSupplementMapper;
    private final ModerationCaseMapper caseMapper;
    private final ModerationDecisionMapper decisionMapper;
    private final ModerationMeasureMapper measureMapper;
    private final AppealMapper appealMapper;
    private final ModerationMeasureExecutor measureExecutor;

    @Transactional
    public Report submitReport(CommunityUser user, Map<String, String> body) {
        String objectType = firstNonBlank(body.get("objectType"), body.get("targetType"));
        String objectId = firstNonBlank(body.get("objectId"), body.get("targetId"));
        String reason = body.get("reason");
        if (objectType == null || objectType.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        if (objectId == null || objectId.isBlank()) {
            throw new FieldContractException("objectId", "对象标识不能为空");
        }
        if (reason == null || reason.isBlank()) {
            throw new FieldContractException("reason", "举报原因不能为空");
        }
        Instant now = Instant.now();
        Report report = new Report();
        report.setId(TokenSupport.newId());
        report.setReporterId(user.getId());
        report.setObjectType(objectType.trim().toUpperCase(Locale.ROOT));
        report.setObjectId(objectId.trim());
        report.setReason(reason.trim());
        report.setDetail(trimToNull(body.get("detail")));
        report.setStatus("SUBMITTED");
        report.setCreatedAt(now);
        reportMapper.insert(report);

        ModerationCase moderationCase = new ModerationCase();
        moderationCase.setId(TokenSupport.newId());
        moderationCase.setReportId(report.getId());
        moderationCase.setStatus("OPEN");
        moderationCase.setCreatedAt(now);
        moderationCase.setUpdatedAt(now);
        caseMapper.insert(moderationCase);
        return report;
    }

    public List<UserReportView> listMyReports(CommunityUser user) {
        return reportMapper.listByReporterId(user.getId()).stream()
                .map(report -> {
                    ModerationCase moderationCase = caseMapper.findByReportId(report.getId());
                    return UserReportView.builder()
                            .id(report.getId())
                            .status(report.getStatus())
                            .targetType(report.getObjectType())
                            .targetId(report.getObjectId())
                            .updatedAt(moderationCase == null ? report.getCreatedAt() : moderationCase.getUpdatedAt())
                            .build();
                })
                .toList();
    }

    public UserReportDetailView getMyReport(CommunityUser user, String reportId) {
        Report report = reportMapper.selectById(reportId);
        if (report == null || !user.getId().equals(report.getReporterId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        ModerationCase moderationCase = caseMapper.findByReportId(report.getId());
        ModerationMeasure measure = moderationCase == null ? null : measureMapper.findLatestByCaseId(moderationCase.getId());
        return UserReportDetailView.builder()
                .id(report.getId())
                .status(report.getStatus())
                .targetType(report.getObjectType())
                .targetId(report.getObjectId())
                .reason(report.getReason())
                .detail(report.getDetail())
                .createdAt(report.getCreatedAt())
                .updatedAt(moderationCase == null ? report.getCreatedAt() : moderationCase.getUpdatedAt())
                .caseId(moderationCase == null ? null : moderationCase.getId())
                .caseStatus(moderationCase == null ? null : moderationCase.getStatus())
                .measureId(measure == null ? null : measure.getId())
                .build();
    }

    @Transactional
    public ReportSupplementView addReportSupplement(CommunityUser user, String reportId, Map<String, String> body) {
        Report report = reportMapper.selectById(reportId);
        if (report == null || !user.getId().equals(report.getReporterId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        String supplementBody = firstNonBlank(body.get("body"), body.get("detail"));
        if (supplementBody == null || supplementBody.isBlank()) {
            throw new FieldContractException("body", "补充说明不能为空");
        }
        ReportSupplement supplement = new ReportSupplement();
        supplement.setId(TokenSupport.newId());
        supplement.setReportId(reportId);
        supplement.setAuthorId(user.getId());
        supplement.setBody(supplementBody.trim());
        supplement.setCreatedAt(Instant.now());
        reportSupplementMapper.insert(supplement);
        return ReportSupplementView.builder()
                .id(supplement.getId())
                .body(supplement.getBody())
                .createdAt(supplement.getCreatedAt())
                .build();
    }

    @Transactional
    public Appeal submitAppeal(CommunityUser user, Map<String, String> body) {
        String measureId = trimToNull(body.get("measureId"));
        String caseId = trimToNull(body.get("caseId"));
        String detail = firstNonBlank(body.get("detail"), body.get("body"));
        if (detail == null || detail.isBlank()) {
            throw new FieldContractException("detail", "申诉说明不能为空");
        }

        ModerationMeasure measure = null;
        if (measureId != null) {
            measure = measureMapper.selectById(measureId);
        } else if (caseId != null) {
            measure = measureMapper.findLatestByCaseId(caseId);
        }
        if (measure == null) {
            throw new FieldContractException("measureId", "未找到可申诉的治理措施");
        }

        ModerationDecision decision = decisionMapper.selectById(measure.getDecisionId());
        if (decision == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        Appeal appeal = new Appeal();
        appeal.setId(TokenSupport.newId());
        appeal.setCaseId(decision.getCaseId());
        appeal.setAppellantId(user.getId());
        appeal.setBody(detail.trim());
        appeal.setStatus("SUBMITTED");
        appeal.setCreatedAt(Instant.now());
        appealMapper.insert(appeal);
        return appeal;
    }

    public List<AppealDetailView> listMyAppeals(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return appealMapper.listByAppellantId(user.getId(), limit).stream()
                .map(appeal -> AppealDetailView.builder()
                        .id(appeal.getId())
                        .caseId(appeal.getCaseId())
                        .body(appeal.getBody())
                        .status(appeal.getStatus())
                        .createdAt(appeal.getCreatedAt())
                        .build())
                .toList();
    }

    public AppealDetailView getMyAppeal(CommunityUser user, String appealId) {
        Appeal appeal = appealMapper.selectById(appealId);
        if (appeal == null || !user.getId().equals(appeal.getAppellantId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return AppealDetailView.builder()
                .id(appeal.getId())
                .caseId(appeal.getCaseId())
                .body(appeal.getBody())
                .status(appeal.getStatus())
                .createdAt(appeal.getCreatedAt())
                .build();
    }

    public List<ModerationCaseView> listOpenCases() {
        return caseMapper.listOpen().stream()
                .map(this::toView)
                .toList();
    }

    public List<ReportAdminView> listReportsForAdmin(String status, int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        return reportMapper.listForAdmin(status, limit).stream()
                .map(report -> {
                    ModerationCase moderationCase = caseMapper.findByReportId(report.getId());
                    return ReportAdminView.builder()
                            .id(report.getId())
                            .reporterId(report.getReporterId())
                            .objectType(report.getObjectType())
                            .objectId(report.getObjectId())
                            .reason(report.getReason())
                            .detail(report.getDetail())
                            .status(report.getStatus())
                            .caseId(moderationCase == null ? null : moderationCase.getId())
                            .caseStatus(moderationCase == null ? null : moderationCase.getStatus())
                            .createdAt(report.getCreatedAt())
                            .build();
                })
                .toList();
    }

    public List<AppealAdminView> listAppealsForAdmin(String status, int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        return appealMapper.listForAdmin(status, limit).stream()
                .map(appeal -> {
                    ModerationMeasure measure = measureMapper.findLatestByCaseId(appeal.getCaseId());
                    return AppealAdminView.builder()
                            .id(appeal.getId())
                            .caseId(appeal.getCaseId())
                            .appellantId(appeal.getAppellantId())
                            .body(appeal.getBody())
                            .status(appeal.getStatus())
                            .measureId(measure == null ? null : measure.getId())
                            .createdAt(appeal.getCreatedAt())
                            .build();
                })
                .toList();
    }

    @Transactional
    public ModerationCaseView decideCase(String caseId, String decidedBy, Map<String, String> body) {
        ModerationCase moderationCase = caseMapper.selectById(caseId);
        if (moderationCase == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!OPEN_CASE_STATUSES.contains(moderationCase.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "案件已处理");
        }
        boolean uphold = isUpholdDecision(body.get("decision"));
        Instant now = Instant.now();

        ModerationDecision moderationDecision = new ModerationDecision();
        moderationDecision.setId(TokenSupport.newId());
        moderationDecision.setCaseId(caseId);
        moderationDecision.setDecision(uphold ? "UPHELD" : "DISMISSED");
        moderationDecision.setDecidedBy(decidedBy);
        moderationDecision.setComment(trimToNull(body.get("comment")));
        moderationDecision.setDecidedAt(now);
        decisionMapper.insert(moderationDecision);

        Report report = reportMapper.selectById(moderationCase.getReportId());
        if (uphold && report != null) {
            ModerationMeasure measure = new ModerationMeasure();
            measure.setId(TokenSupport.newId());
            measure.setDecisionId(moderationDecision.getId());
            measure.setMeasureType(ModerationMeasureExecutor.MEASURE_HIDE);
            measure.setTargetType(report.getObjectType());
            measure.setTargetId(report.getObjectId());
            measure.setCreatedAt(now);
            measureMapper.insert(measure);
            measureExecutor.apply(measure);
            report.setStatus("CLOSED");
        } else if (report != null) {
            report.setStatus("CLOSED");
        }
        if (report != null) {
            reportMapper.updateById(report);
        }

        moderationCase.setStatus("CLOSED");
        moderationCase.setAssignedTo(decidedBy);
        moderationCase.setUpdatedAt(now);
        caseMapper.updateById(moderationCase);
        return toView(moderationCase);
    }

    @Transactional
    public Report decideReportQueue(String reportId, String decidedBy, Map<String, String> body) {
        Report report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        ModerationCase moderationCase = caseMapper.findByReportId(reportId);
        if (moderationCase != null && OPEN_CASE_STATUSES.contains(moderationCase.getStatus())) {
            String decision = body.get("decision");
            String mapped = "REJECTED".equalsIgnoreCase(decision) ? "DISMISSED" : "UPHELD";
            decideCase(moderationCase.getId(), decidedBy, Map.of(
                    "decision", mapped,
                    "comment", body.getOrDefault("comment", "")));
            return reportMapper.selectById(reportId);
        }
        if (!Set.of("SUBMITTED", "TRIAGED").contains(report.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "举报已处理");
        }
        report.setStatus("CLOSED");
        reportMapper.updateById(report);
        return report;
    }

    @Transactional
    public Appeal decideAppealQueue(String appealId, String decidedBy, Map<String, String> body) {
        Appeal appeal = appealMapper.selectById(appealId);
        if (appeal == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (!Set.of("SUBMITTED", "PENDING", "REVIEWING").contains(appeal.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "申诉已处理");
        }
        boolean approved = isAppealApproved(body.get("decision"));
        Instant now = Instant.now();

        if (approved) {
            ModerationMeasure measure = measureMapper.findLatestByCaseId(appeal.getCaseId());
            if (measure != null) {
                measureExecutor.revoke(measure);
            }
            appeal.setStatus("DECIDED");
        } else {
            appeal.setStatus("DECIDED");
        }
        appealMapper.updateById(appeal);

        ModerationCase moderationCase = caseMapper.selectById(appeal.getCaseId());
        if (moderationCase != null) {
            moderationCase.setUpdatedAt(now);
            moderationCase.setAssignedTo(decidedBy);
            caseMapper.updateById(moderationCase);
        }
        return appeal;
    }

    private ModerationCaseView toView(ModerationCase moderationCase) {
        Report report = reportMapper.selectById(moderationCase.getReportId());
        return ModerationCaseView.builder()
                .id(moderationCase.getId())
                .reportId(moderationCase.getReportId())
                .status(moderationCase.getStatus())
                .objectType(report == null ? null : report.getObjectType())
                .objectId(report == null ? null : report.getObjectId())
                .reason(report == null ? null : report.getReason())
                .createdAt(moderationCase.getCreatedAt())
                .build();
    }

    private static boolean isUpholdDecision(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("decision", "决定不能为空");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "UPHELD", "VIOLATION", "RESOLVED", "APPROVED" -> true;
            case "DISMISSED", "NO_VIOLATION", "REJECTED" -> false;
            default -> throw new FieldContractException("decision", "决定值无效");
        };
    }

    private static boolean isAppealApproved(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("decision", "决定不能为空");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return "APPROVED".equals(normalized) || "UPHOLD".equals(normalized) || "MODIFY".equals(normalized);
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
