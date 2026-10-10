package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.AppealAdminView;
import top.pxczxn.xingyu.community.dto.AppealDetailView;
import top.pxczxn.xingyu.community.dto.ModerationCaseView;
import top.pxczxn.xingyu.community.dto.ReportAdminView;
import top.pxczxn.xingyu.community.dto.ReportSupplementView;
import top.pxczxn.xingyu.community.dto.ReportTargetView;
import top.pxczxn.xingyu.community.dto.UserReportDetailView;
import top.pxczxn.xingyu.community.dto.UserReportView;
import top.pxczxn.xingyu.community.entity.Appeal;
import top.pxczxn.xingyu.community.entity.Article;
import top.pxczxn.xingyu.community.entity.Comment;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.FormalRevision;
import top.pxczxn.xingyu.community.entity.ModerationCase;
import top.pxczxn.xingyu.community.entity.ModerationDecision;
import top.pxczxn.xingyu.community.entity.ModerationMeasure;
import top.pxczxn.xingyu.community.entity.Moment;
import top.pxczxn.xingyu.community.entity.MomentRevision;
import top.pxczxn.xingyu.community.entity.PublishedRevision;
import top.pxczxn.xingyu.community.entity.Report;
import top.pxczxn.xingyu.community.entity.ReportSupplement;
import top.pxczxn.xingyu.community.mapper.AppealMapper;
import top.pxczxn.xingyu.community.mapper.ArticleMapper;
import top.pxczxn.xingyu.community.mapper.CommentMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.mapper.FormalRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationCaseMapper;
import top.pxczxn.xingyu.community.mapper.ModerationDecisionMapper;
import top.pxczxn.xingyu.community.mapper.ModerationMeasureMapper;
import top.pxczxn.xingyu.community.mapper.MomentMapper;
import top.pxczxn.xingyu.community.mapper.MomentRevisionMapper;
import top.pxczxn.xingyu.community.mapper.ReportMapper;
import top.pxczxn.xingyu.community.mapper.ReportSupplementMapper;
import top.pxczxn.xingyu.community.mapper.PublishedRevisionMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;

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

    /**
     * 用户侧**当前正式支持**的举报对象类型（服务端白名单，不是前端隐藏）。
     *
     * <p>只有这三类能被 {@link ModerationMeasureExecutor} 真正治理：ARTICLE/MOMENT 有
     * 真实 hide/restore，COMMENT 隐藏有效、恢复已修（见 restoreTarget 的 VISIBLE 修正）。
     *
     * <p>**刻意排除** USER / SERIES：它们进入措施执行器后走 {@code default:} 空分支 = no-op，
     * 也就是"举报成功 → 管理员处理 → 什么也不会发生"。让用户看到这种假闭环比没有入口更糟。
     *
     * <p>后续若单独定档（USER → 账号处置；SERIES → 归档/可见性）再扩这个集合，不改调用点。
     */
    private static final Set<String> REPORTABLE_OBJECT_TYPES = Set.of("ARTICLE", "MOMENT", "COMMENT");

    /** 举报尚未终结的状态（与 report 真实生命周期一致）。 */
    private static final Set<String> ACTIVE_REPORT_STATUSES = Set.of("SUBMITTED", "TRIAGED");

    private final ReportMapper reportMapper;
    private final ReportSupplementMapper reportSupplementMapper;
    private final ModerationCaseMapper caseMapper;
    private final ModerationDecisionMapper decisionMapper;
    private final ModerationMeasureMapper measureMapper;
    private final AppealMapper appealMapper;
    private final ArticleMapper articleMapper;
    private final MomentMapper momentMapper;
    private final CommentMapper commentMapper;
    private final MomentRevisionMapper momentRevisionMapper;
    private final PublishedRevisionMapper publishedRevisionMapper;
    private final FormalRevisionMapper formalRevisionMapper;
    private final CommunityProfileMapper profileMapper;
    private final ModerationMeasureExecutor measureExecutor;

    /**
     * 举报目标预览：从内容上下文发起举报时，由服务端现查并返回"要举报的是什么"。
     *
     * <p>这一步同时承担<b>资格校验</b>，与提交时的校验是同一套判断（提交时会再查一遍，
     * 不信任预览阶段的结果）：
     * <ol>
     *   <li>objectType 必须在白名单内 —— USER / SERIES 直接拒绝；</li>
     *   <li>对象必须真实存在 —— 否则 404；</li>
     *   <li>不能举报自己的内容 —— 否则 409；</li>
     * </ol>
     *
     * <p>返回的标题/摘要/作者都是服务端权威数据，前端不得自行拼装。{@code alreadyReported}
     * 让页面能如实提示"你已举报过"，而不是让用户以为提交成功了一条新的。
     */
    public ReportTargetView previewReportTarget(CommunityUser user, String rawObjectType, String objectId) {
        if (rawObjectType == null || rawObjectType.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        if (objectId == null || objectId.isBlank()) {
            throw new FieldContractException("objectId", "对象标识不能为空");
        }
        String objectType = rawObjectType.trim().toUpperCase(Locale.ROOT);
        if (!REPORTABLE_OBJECT_TYPES.contains(objectType)) {
            throw new FieldContractException("objectType", "暂不支持举报该类型的内容");
        }
        String ownerId = resolveObjectOwner(objectType, objectId.trim());
        if (ownerId == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "被举报的内容不存在");
        }
        if (ownerId.equals(user.getId())) {
            throw new ContractException(ErrorCode.CONFLICT, "不能举报自己的内容");
        }

        TargetDescription description = describeTarget(objectType, objectId.trim());

        CommunityProfile profile = profileMapper.findByUserId(ownerId);
        return ReportTargetView.builder()
                .objectType(objectType)
                .objectId(objectId.trim())
                .title(description.title())
                .summary(description.summary())
                .authorId(ownerId)
                .authorUsername(profile == null ? null : profile.getUsername())
                .authorDisplayName(profile == null ? null : profile.getDisplayName())
                .alreadyReported(reportMapper.findActiveByReporterAndObject(
                        user.getId(), objectType, objectId.trim()) != null)
                .build();
    }

    /**
     * 解析一篇文章当前对外可见的正式版本（先 published，回退到最新 formal）。
     * 只用于展示标题/摘要，不参与权限判断。
     */
    private FormalRevision resolveArticleRevision(String articleId) {
        PublishedRevision published = publishedRevisionMapper.findByArticleId(articleId);
        if (published != null && published.getFormalRevisionId() != null) {
            FormalRevision revision = formalRevisionMapper.findById(published.getFormalRevisionId());
            if (revision != null) {
                return revision;
            }
        }
        List<FormalRevision> revisions = formalRevisionMapper.listByArticleId(articleId);
        return revisions.isEmpty() ? null : revisions.get(0);
    }

    /** 摘要裁剪：只用于展示，绝不当作证据本体。 */
    private String abbreviate(String body) {
        if (body == null) {
            return null;
        }
        String trimmed = body.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= 160 ? trimmed : trimmed.substring(0, 160) + "…";
    }

    /**
     * 对象的人类可读描述（标题 + 摘要），供举报预览与列表复用。
     *
     * <p>这是「举报了什么」的唯一样本来源：列表行与详情页都不得自行拼装标题/作者，
     * 也不得把 {@code objectId}（UUID）当作描述。对象已被删除时返回全 null，
     * 由调用方如实渲染为"内容已不存在"，而不是让 UUID 冒充内容。
     *
     * <p>只读、无副作用；不参与权限判断（权限由调用点各自保证）。
     */
    private TargetDescription describeTarget(String objectType, String objectId) {
        String title = null;
        String summary = null;
        switch (objectType == null ? "" : objectType) {
            case "ARTICLE" -> {
                FormalRevision revision = resolveArticleRevision(objectId);
                if (revision != null) {
                    title = revision.getTitle();
                    summary = revision.getSummary();
                }
            }
            case "MOMENT" -> {
                MomentRevision revision = momentRevisionMapper.findLatestByMomentId(objectId);
                if (revision != null) {
                    summary = abbreviate(revision.getBody());
                }
            }
            case "COMMENT" -> {
                Comment comment = commentMapper.selectById(objectId);
                if (comment != null) {
                    summary = abbreviate(comment.getBody());
                }
            }
            default -> {
                // 未知类型：不猜，返回空描述。
            }
        }
        return new TargetDescription(title, summary);
    }

    /** {@link #describeTarget} 的返回：可空字段，无描述时全 null。 */
    private record TargetDescription(String title, String summary) {
    }

    @Transactional
    public Report submitReport(CommunityUser user, Map<String, String> body) {
        String rawObjectType = firstNonBlank(body.get("objectType"), body.get("targetType"));
        final String objectId = firstNonBlank(body.get("objectId"), body.get("targetId"));
        String reason = body.get("reason");
        if (rawObjectType == null || rawObjectType.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        if (objectId == null || objectId.isBlank()) {
            throw new FieldContractException("objectId", "对象标识不能为空");
        }
        if (reason == null || reason.isBlank()) {
            throw new FieldContractException("reason", "举报原因不能为空");
        }
        final String objectType = rawObjectType.trim().toUpperCase(Locale.ROOT);

        // 白名单：不支持的 objectType 直接拒绝（服务端保证，不能只靠前端不显示选项）。
        if (!REPORTABLE_OBJECT_TYPES.contains(objectType)) {
            throw new FieldContractException("objectType", "暂不支持举报该类型的内容");
        }

        // 对象必须真实存在，且不能举报自己的内容。
        // 前端传来的标题/作者等展示信息一律不信任 —— 这里只用 objectId 现查权威数据。
        String ownerId = resolveObjectOwner(objectType, objectId);
        if (ownerId == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "被举报的内容不存在");
        }
        if (ownerId.equals(user.getId())) {
            throw new ContractException(ErrorCode.CONFLICT, "不能举报自己的内容");
        }

        // 重复举报（最小诚实规则）：同一用户对同一对象已有未终结举报时，不再建第二条 active report，
        // 直接返回已有记录（幂等）。terminal report 后是否允许重新举报，留待状态模型定档，现在不设计。
        Report existing = reportMapper.findActiveByReporterAndObject(user.getId(), objectType, objectId);
        if (existing != null) {
            return existing;
        }

        Instant now = Instant.now();
        Report report = new Report();
        report.setId(TokenSupport.newId());
        report.setReporterId(user.getId());
        report.setObjectType(objectType);
        report.setObjectId(objectId.trim());
        report.setReason(reason.trim());
        report.setDetail(trimToNull(body.get("detail")));
        report.setStatus("SUBMITTED");
        report.setCreatedAt(now);
        try {
            reportMapper.insert(report);
        } catch (DataIntegrityViolationException ex) {
            // 并发兜底：两个请求同时通过上面的 findActive 检查时，唯一索引裁决，返回已有记录。
            Report winner = reportMapper.findActiveByReporterAndObject(user.getId(), objectType, objectId);
            if (winner != null) {
                return winner;
            }
            throw new ContractException(ErrorCode.CONFLICT, "举报提交冲突，请稍后重试");
        }

        ModerationCase moderationCase = new ModerationCase();
        moderationCase.setId(TokenSupport.newId());
        moderationCase.setReportId(report.getId());
        moderationCase.setStatus("OPEN");
        moderationCase.setCreatedAt(now);
        moderationCase.setUpdatedAt(now);
        caseMapper.insert(moderationCase);
        return report;
    }

    /**
     * 用 objectId 现查对象所有者。对象不存在返回 null。类型必须已在白名单内。
     */
    private String resolveObjectOwner(String objectType, String objectId) {
        return switch (objectType) {
            case "ARTICLE" -> {
                Article article = articleMapper.selectById(objectId);
                yield article == null ? null : article.getOwnerId();
            }
            case "MOMENT" -> {
                Moment moment = momentMapper.selectById(objectId);
                yield moment == null ? null : moment.getAuthorId();
            }
            case "COMMENT" -> {
                Comment comment = commentMapper.selectById(objectId);
                yield comment == null ? null : comment.getAuthorId();
            }
            default -> null;
        };
    }

    public List<UserReportView> listMyReports(CommunityUser user) {
        return reportMapper.listByReporterId(user.getId()).stream()
                .map(report -> {
                    ModerationCase moderationCase = caseMapper.findByReportId(report.getId());
                    // 「举报了什么」由服务端现查，前端不得拿 targetId 当描述。
                    TargetDescription description = describeTarget(report.getObjectType(), report.getObjectId());
                    return UserReportView.builder()
                            .id(report.getId())
                            .status(report.getStatus())
                            .targetType(report.getObjectType())
                            .targetId(report.getObjectId())
                            .targetTitle(description.title())
                            .targetSummary(description.summary())
                            .reason(report.getReason())
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
        TargetDescription description = describeTarget(report.getObjectType(), report.getObjectId());
        return UserReportDetailView.builder()
                .id(report.getId())
                .status(report.getStatus())
                .targetType(report.getObjectType())
                .targetId(report.getObjectId())
                .targetTitle(description.title())
                .targetSummary(description.summary())
                .reason(report.getReason())
                .detail(report.getDetail())
                .createdAt(report.getCreatedAt())
                .updatedAt(moderationCase == null ? report.getCreatedAt() : moderationCase.getUpdatedAt())
                .caseId(moderationCase == null ? null : moderationCase.getId())
                .caseStatus(moderationCase == null ? null : moderationCase.getStatus())
                .measureId(measure == null ? null : measure.getId())
                .supplements(supplementViews(report.getId()))
                .build();
    }

    /**
     * 读回某条举报的历次补充说明（按真实 createdAt 升序）。
     *
     * <p>补充说明有真实用户入口，读链必须闭合：举报人重开详情页、管理员审阅举报时
     * 都要能看到同样的证据。权限由各自入口的服务端校验保证（getMyReport 校验 owner；
     * listReportsForAdmin 本身已是 admin 端点），这里只负责取数。
     */
    private List<ReportSupplementView> supplementViews(String reportId) {
        return reportSupplementMapper.listByReportId(reportId).stream()
                .map(supplement -> ReportSupplementView.builder()
                        .id(supplement.getId())
                        .body(supplement.getBody())
                        .createdAt(supplement.getCreatedAt())
                        .build())
                .toList();
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

        // 申诉的产品对象 = **被治理措施实际影响到的内容所有者**，不是举报人的二次投诉。
        // 因此只有措施目标的所有者本人能申诉；举报人、路人一律 404（不泄露存在性）。
        if (!isOwnerOfMeasureTarget(user, measure)) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }

        // 一个 case 只允许一次申诉：服务端明确保证，不靠前端隐藏按钮。
        // 并发由 appeal 上的唯一索引 uk_appeal_case 兜底（见 V046/后续约束），此处先做快速拒绝。
        Appeal existing = appealMapper.findByCaseId(decision.getCaseId());
        if (existing != null) {
            throw new ContractException(ErrorCode.CONFLICT, "该案件已提交过申诉");
        }

        Appeal appeal = new Appeal();
        appeal.setId(TokenSupport.newId());
        appeal.setCaseId(decision.getCaseId());
        appeal.setAppellantId(user.getId());
        appeal.setBody(detail.trim());
        appeal.setStatus("PENDING");
        appeal.setOutcome(null);
        appeal.setDecidedBy(null);
        appeal.setDecidedAt(null);
        appeal.setDecisionNote(null);
        appeal.setCreatedAt(Instant.now());
        try {
            appealMapper.insert(appeal);
        } catch (DataIntegrityViolationException ex) {
            // 并发下两个请求同时通过上面的 findByCaseId 检查时的兜底：唯一键裁决。
            throw new ContractException(ErrorCode.CONFLICT, "该案件已提交过申诉");
        }
        return appeal;
    }

    /**
     * 措施目标的所有者判定。举报/治理只对 ARTICLE / MOMENT / COMMENT 有实际措施，
     * 所以所有者判定也只需覆盖这三类；其余类型一律不认为是"受影响的所有者"。
     */
    private boolean isOwnerOfMeasureTarget(CommunityUser user, ModerationMeasure measure) {
        String type = measure.getTargetType();
        String targetId = measure.getTargetId();
        if (type == null || targetId == null) {
            return false;
        }
        return switch (type.trim().toUpperCase(Locale.ROOT)) {
            case "ARTICLE" -> {
                Article article = articleMapper.selectById(targetId);
                yield article != null && user.getId().equals(article.getOwnerId());
            }
            case "MOMENT" -> {
                Moment moment = momentMapper.selectById(targetId);
                yield moment != null && user.getId().equals(moment.getAuthorId());
            }
            case "COMMENT" -> {
                Comment comment = commentMapper.selectById(targetId);
                yield comment != null && user.getId().equals(comment.getAuthorId());
            }
            default -> false;
        };
    }

    public List<AppealDetailView> listMyAppeals(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return appealMapper.listByAppellantId(user.getId(), limit).stream()
                .map(this::toAppealDetailView)
                .toList();
    }

    public AppealDetailView getMyAppeal(CommunityUser user, String appealId) {
        Appeal appeal = appealMapper.selectById(appealId);
        if (appeal == null || !user.getId().equals(appeal.getAppellantId())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return toAppealDetailView(appeal);
    }

    private AppealDetailView toAppealDetailView(Appeal appeal) {
        // 「原处理对象 / 原决定」链：case → report → 对象描述 + 最新 measure 类型。
        // 任一环节缺失时该字段为 null，UI 如实渲染为"无法解析"，绝不猜测。
        String targetType = null;
        String targetId = null;
        String targetTitle = null;
        String targetSummary = null;
        String measureType = null;
        ModerationCase moderationCase = appeal.getCaseId() == null ? null : caseMapper.selectById(appeal.getCaseId());
        if (moderationCase != null) {
            Report report = reportMapper.selectById(moderationCase.getReportId());
            if (report != null) {
                targetType = report.getObjectType();
                targetId = report.getObjectId();
                TargetDescription description = describeTarget(report.getObjectType(), report.getObjectId());
                targetTitle = description.title();
                targetSummary = description.summary();
            }
            ModerationMeasure measure = measureMapper.findLatestByCaseId(moderationCase.getId());
            measureType = measure == null ? null : measure.getMeasureType();
        }
        return AppealDetailView.builder()
                .id(appeal.getId())
                .caseId(appeal.getCaseId())
                .body(appeal.getBody())
                .status(appeal.getStatus())
                .outcome(appeal.getOutcome())
                .decidedAt(appeal.getDecidedAt())
                .decisionNote(appeal.getDecisionNote())
                .targetType(targetType)
                .targetId(targetId)
                .targetTitle(targetTitle)
                .targetSummary(targetSummary)
                .measureType(measureType)
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
                            .supplements(supplementViews(report.getId()))
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
                            .outcome(appeal.getOutcome())
                            .decidedBy(appeal.getDecidedBy())
                            .decidedAt(appeal.getDecidedAt())
                            .decisionNote(appeal.getDecisionNote())
                            .measureId(measure == null ? null : measure.getId())
                            .createdAt(appeal.getCreatedAt())
                            .build();
                })
                .toList();
    }

    @Transactional
    public ModerationCaseView decideCase(String caseId, String decidedBy, Map<String, String> body) {
        // 行锁：两个管理员同时裁决同一案件时串行化，后到者读到终局状态后失败，
        // 保证「不重复写 decision / 不重复执行 measure」。
        ModerationCase moderationCase = caseMapper.lockById(caseId);
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
        }
        // 举报在"认定违规"与"驳回"两种结果下都终结（CLOSED）—— 结果差异由 decision 表达，
        // 不由 report.status 表达。用户侧要看结论，必须读 decision，而不是靠 report.status 猜。
        if (report != null) {
            report.setStatus("CLOSED");
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
        // 先取行锁：两个管理员同时处理同一条申诉时，后到者会阻塞到前者提交，然后再读到终局状态。
        // 这一步是原子性的关键 —— 只靠"读一下再写"会在两个请求间产生窗口。
        Appeal appeal = appealMapper.lockById(appealId);
        if (appeal == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        // 终局申诉（APPROVED/REJECTED）不可再次处理 → CONFLICT，绝不重复执行 measure。
        if (!"PENDING".equals(appeal.getStatus())) {
            throw new ContractException(ErrorCode.CONFLICT, "申诉已处理");
        }
        boolean approved = isAppealApproved(body.get("decision"));
        Instant now = Instant.now();

        // 批准 → overturn 对应 measure；驳回 → measure 保持不变。二者与结果持久化在同一事务内。
        if (approved) {
            ModerationMeasure measure = measureMapper.findLatestByCaseId(appeal.getCaseId());
            if (measure != null) {
                measureExecutor.revoke(measure);
            }
        }
        appeal.setStatus(approved ? "APPROVED" : "REJECTED");
        appeal.setOutcome(approved ? "APPROVED" : "REJECTED");
        appeal.setDecidedBy(decidedBy);
        appeal.setDecidedAt(now);
        appeal.setDecisionNote(trimToNull(body.get("comment")));
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
