package top.pxczxn.xingyu.community.service;

import top.pxczxn.xingyu.common.contract.ContractException;
import top.pxczxn.xingyu.common.contract.ErrorCode;
import top.pxczxn.xingyu.common.contract.FieldContractException;
import top.pxczxn.xingyu.community.dto.EventSubmissionAdminView;
import top.pxczxn.xingyu.community.dto.EventSubmissionView;
import top.pxczxn.xingyu.community.dto.EventView;
import top.pxczxn.xingyu.community.entity.CommunityEvent;
import top.pxczxn.xingyu.community.entity.CommunityProfile;
import top.pxczxn.xingyu.community.entity.CommunityUser;
import top.pxczxn.xingyu.community.entity.EventSubmission;
import top.pxczxn.xingyu.community.entity.SearchDocument;
import top.pxczxn.xingyu.community.mapper.CommunityEventMapper;
import top.pxczxn.xingyu.community.mapper.CommunityProfileMapper;
import top.pxczxn.xingyu.community.entity.EventRegistration;
import top.pxczxn.xingyu.community.mapper.EventRegistrationMapper;
import top.pxczxn.xingyu.community.mapper.EventSubmissionMapper;
import top.pxczxn.xingyu.community.mapper.SearchDocumentMapper;
import top.pxczxn.xingyu.community.support.TokenSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CommunityEventService {

    private final CommunityEventMapper eventMapper;
    private final EventSubmissionMapper submissionMapper;
    private final EventRegistrationMapper registrationMapper;
    private final SearchDocumentMapper searchDocumentMapper;
    private final CommunityProfileMapper profileMapper;

    public List<EventView> listActive(int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return eventMapper.listActive(limit).stream().map(this::toView).toList();
    }

    public EventView getById(String eventId) {
        CommunityEvent event = requireActiveEvent(eventId);
        return toView(event);
    }

    @Transactional
    public Map<String, Object> register(CommunityUser user, String eventId) {
        CommunityEvent event = requireActiveEvent(eventId);
        EventRegistration existing = registrationMapper.findByEventAndUser(eventId, user.getId());
        if (existing != null && "REGISTERED".equals(existing.getStatus())) {
            // 已报名属历史记录读取，不受结束门禁影响——不产生任何新行。
            return registrationStatus(existing);
        }
        requireNotEnded(event);
        Instant now = Instant.now();
        if (existing == null) {
            EventRegistration registration = new EventRegistration();
            registration.setId(TokenSupport.newId());
            registration.setEventId(eventId);
            registration.setUserId(user.getId());
            registration.setStatus("REGISTERED");
            registration.setCreatedAt(now);
            try {
                registrationMapper.insert(registration);
            } catch (DuplicateKeyException ex) {
                // uk_event_registration(event_id, user_id) 命中 ⇒ 并发下已有同 event/user 行。
                // 唯一约束是并发安全的唯一保证：竞态败者不当作成功，而是重读既有行做幂等返回。
                EventRegistration raced = registrationMapper.findByEventAndUser(eventId, user.getId());
                if (raced == null) {
                    // 约束名不匹配我们的假设 ⇒ 不是本路径的冲突，不得吞掉。
                    throw ex;
                }
                return registrationStatus(raced);
            }
            return registrationStatus(registration);
        }
        existing.setStatus("REGISTERED");
        existing.setCancelledAt(null);
        registrationMapper.updateById(existing);
        return registrationStatus(existing);
    }

    @Transactional
    public void cancelRegistration(CommunityUser user, String eventId) {
        requireActiveEvent(eventId);
        EventRegistration existing = registrationMapper.findByEventAndUser(eventId, user.getId());
        if (existing == null || !"REGISTERED".equals(existing.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        existing.setStatus("CANCELLED");
        existing.setCancelledAt(Instant.now());
        registrationMapper.updateById(existing);
    }

    @Transactional
    public EventSubmissionView submit(CommunityUser user, String eventId, Map<String, String> body) {
        CommunityEvent event = requireActiveEvent(eventId);
        // 结束门禁优先于 submissionOpen：已结束就不存在"投稿窗口"这个概念。
        requireNotEnded(event);
        if (!Boolean.TRUE.equals(event.getSubmissionOpen())) {
            throw new ContractException(ErrorCode.CONFLICT, "活动投稿已关闭");
        }
        String objectType = normalizeObjectType(body.get("objectType"));
        String objectId = trimRequired(body.get("objectId"), "objectId");
        if (searchDocumentMapper.findByObject(objectType, objectId) == null) {
            throw new ContractException(ErrorCode.NOT_FOUND, "投稿内容不存在");
        }
        EventSubmission existing = submissionMapper.findByEventAndObject(eventId, user.getId(), objectType, objectId);
        if (existing != null) {
            // 重复投稿幂等返回既有行，不产生新 submission。
            return toSubmissionView(existing);
        }
        EventSubmission submission = new EventSubmission();
        submission.setId(TokenSupport.newId());
        submission.setEventId(eventId);
        submission.setAuthorId(user.getId());
        submission.setObjectType(objectType);
        submission.setObjectId(objectId);
        submission.setNote(trimToNull(body.get("note")));
        submission.setStatus("SUBMITTED");
        submission.setCreatedAt(Instant.now());
        submissionMapper.insert(submission);
        return toSubmissionView(submission);
    }

    public List<EventSubmissionView> listMySubmissions(CommunityUser user, int limit) {
        if (limit <= 0) {
            limit = 20;
        }
        return submissionMapper.listByAuthorId(user.getId(), limit).stream()
                .map(this::toSubmissionView)
                .toList();
    }

    public List<EventSubmissionView> listAcceptedSubmissions(String eventId, int limit) {
        requireActiveEvent(eventId);
        if (limit <= 0) {
            limit = 50;
        }
        return submissionMapper.listAcceptedByEventId(eventId, limit).stream()
                .map(this::toSubmissionView)
                .toList();
    }

    public List<EventSubmissionAdminView> listSubmissionsForAdmin(String eventId, int limit) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (limit <= 0) {
            limit = 100;
        }
        return submissionMapper.listByEventId(eventId, limit).stream()
                .map(this::toAdminSubmissionView)
                .toList();
    }

    @Transactional
    public EventSubmissionAdminView reviewSubmissionForAdmin(String submissionId, Map<String, String> body) {
        EventSubmission submission = submissionMapper.selectById(submissionId);
        if (submission == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        String status = normalizeReviewStatus(body.get("status"));
        submission.setStatus(status);
        submissionMapper.updateById(submission);
        return toAdminSubmissionView(submission);
    }

    public List<CommunityEvent> listForAdmin(int limit) {
        if (limit <= 0) {
            limit = 100;
        }
        return eventMapper.listAll(limit);
    }

    @Transactional
    public CommunityEvent createForAdmin(Map<String, Object> body) {
        Instant now = Instant.now();
        String slug = trimRequired(String.valueOf(body.getOrDefault("slug", "")), "slug");
        if (eventMapper.findBySlug(slug) != null) {
            throw new ContractException(ErrorCode.CONFLICT, "活动别名已存在");
        }
        CommunityEvent event = new CommunityEvent();
        event.setId(TokenSupport.newId());
        event.setSlug(slug);
        event.setTitle(trimRequired(String.valueOf(body.getOrDefault("title", "")), "title"));
        event.setBody(String.valueOf(body.getOrDefault("body", "")).trim());
        event.setStatus(normalizeEventStatus(body.get("status"), "ACTIVE"));
        event.setSubmissionOpen(parseBoolean(body.get("submissionOpen"), true));
        // 未提供 startsAt 时沿用既有兼容默认（创建即开始），不破坏既有 seed / 创建链路。
        event.setStartsAt(body.containsKey("startsAt") ? parseInstant(body.get("startsAt"), "startsAt") : now);
        event.setEndsAt(parseNullableInstant(body.get("endsAt"), "endsAt"));
        validateTimeRange(event.getStartsAt(), event.getEndsAt());
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        eventMapper.insert(event);
        return event;
    }

    @Transactional
    public CommunityEvent updateForAdmin(String eventId, Map<String, Object> body) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        if (body.containsKey("title")) {
            event.setTitle(trimRequired(String.valueOf(body.get("title")), "title"));
        }
        if (body.containsKey("body")) {
            event.setBody(String.valueOf(body.get("body")).trim());
        }
        if (body.containsKey("status")) {
            event.setStatus(normalizeEventStatus(body.get("status"), event.getStatus()));
        }
        if (body.containsKey("submissionOpen")) {
            event.setSubmissionOpen(parseBoolean(body.get("submissionOpen"), event.getSubmissionOpen()));
        }
        if (body.containsKey("startsAt")) {
            event.setStartsAt(parseInstant(body.get("startsAt"), "startsAt"));
        }
        // endsAt 可为 null：显式传入 null 表示"取消自动结束时间"。
        // updateById 会跳过 null 字段，所以清空必须走定点 UPDATE。
        boolean clearEndsAt = false;
        if (body.containsKey("endsAt")) {
            Instant endsAt = parseNullableInstant(body.get("endsAt"), "endsAt");
            if (endsAt == null) {
                clearEndsAt = true;
            } else {
                event.setEndsAt(endsAt);
            }
        }
        validateTimeRange(event.getStartsAt(), clearEndsAt ? null : event.getEndsAt());
        event.setUpdatedAt(Instant.now());
        eventMapper.updateById(event);
        if (clearEndsAt) {
            eventMapper.updateEndsAt(event.getId(), null, event.getUpdatedAt());
            event.setEndsAt(null);
        }
        return event;
    }

    private CommunityEvent requireActiveEvent(String eventId) {
        CommunityEvent event = eventMapper.selectById(eventId);
        if (event == null || !"ACTIVE".equals(event.getStatus())) {
            throw new ContractException(ErrorCode.NOT_FOUND);
        }
        return event;
    }

    /**
     * 活动是否已结束。
     *
     * <p>语义边界（锁定，不得更改）：
     * <ul>
     *   <li>{@code status} 是发布状态，只表达"公开可见 / 已下线"，与时间无关。</li>
     *   <li>{@code startsAt} 不是"报名开放时间"，不参与任何写入门禁。</li>
     *   <li>{@code endsAt == null} 表示"当前未配置自动结束时间"，<b>不得</b>视为已结束。</li>
     *   <li>{@code now >= endsAt}（endsAt 非 null）⇒ 已结束，边界瞬间即算结束。</li>
     * </ul>
     * 已结束的活动仍可浏览历史详情，但禁止新报名、新投稿。</p>
     */
    private boolean isEnded(CommunityEvent event, Instant now) {
        return event.getEndsAt() != null && !now.isBefore(event.getEndsAt());
    }

    /** 写入门禁：已结束的活动拒绝新报名 / 新投稿，沿用既有业务错误契约（409 CONFLICT）。 */
    private void requireNotEnded(CommunityEvent event) {
        if (isEnded(event, Instant.now())) {
            throw new ContractException(ErrorCode.CONFLICT, "活动已结束");
        }
    }

    private EventView toView(CommunityEvent event) {
        return EventView.builder()
                .id(event.getId())
                .slug(event.getSlug())
                .title(event.getTitle())
                .body(event.getBody())
                .startsAt(event.getStartsAt())
                .endsAt(event.getEndsAt())
                .submissionOpen(Boolean.TRUE.equals(event.getSubmissionOpen()))
                .build();
    }

    private Map<String, Object> registrationStatus(EventRegistration registration) {
        return Map.of(
                "id", registration.getId(),
                "eventId", registration.getEventId(),
                "status", registration.getStatus(),
                "createdAt", registration.getCreatedAt());
    }

    private EventSubmissionView toSubmissionView(EventSubmission submission) {
        SearchDocument document = searchDocumentMapper.findByObject(
                submission.getObjectType(), submission.getObjectId());
        return EventSubmissionView.builder()
                .id(submission.getId())
                .eventId(submission.getEventId())
                .objectType(submission.getObjectType())
                .objectId(submission.getObjectId())
                .objectTitle(document == null ? null : document.getTitle())
                .note(submission.getNote())
                .status(submission.getStatus())
                .createdAt(submission.getCreatedAt())
                .build();
    }

    private EventSubmissionAdminView toAdminSubmissionView(EventSubmission submission) {
        SearchDocument document = searchDocumentMapper.findByObject(
                submission.getObjectType(), submission.getObjectId());
        CommunityProfile profile = profileMapper.findByUserId(submission.getAuthorId());
        return EventSubmissionAdminView.builder()
                .id(submission.getId())
                .eventId(submission.getEventId())
                .authorId(submission.getAuthorId())
                .authorUsername(profile == null ? submission.getAuthorId() : profile.getUsername())
                .authorDisplayName(profile == null ? null : profile.getDisplayName())
                .objectType(submission.getObjectType())
                .objectId(submission.getObjectId())
                .objectTitle(document == null ? submission.getObjectId() : document.getTitle())
                .note(submission.getNote())
                .status(submission.getStatus())
                .createdAt(submission.getCreatedAt())
                .build();
    }

    /**
     * 活动状态白名单。领域当前真实支持的状态只有两个：
     * <ul>
     *   <li>{@code ACTIVE} — 公开可见（注意：与时间无关，不代表"进行中"）。</li>
     *   <li>{@code ARCHIVED} — 已下线，不出现在公开列表/详情。</li>
     * </ul>
     * 不引入 DRAFT / CANCELLED / PUBLISHED 等新词汇——领域没有对应语义。
     */
    private static final java.util.Set<String> EVENT_STATUS_WHITELIST =
            java.util.Set.of("ACTIVE", "ARCHIVED");

    private static String normalizeEventStatus(Object raw, String defaultValue) {
        if (raw == null) {
            return defaultValue;
        }
        String normalized = String.valueOf(raw).trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return defaultValue;
        }
        if (!EVENT_STATUS_WHITELIST.contains(normalized)) {
            throw new FieldContractException("status", "活动状态无效");
        }
        return normalized;
    }

    private static Instant parseInstant(Object raw, String field) {
        if (raw == null || String.valueOf(raw).isBlank()) {
            throw new FieldContractException(field, "时间不能为空");
        }
        try {
            return Instant.parse(String.valueOf(raw).trim());
        } catch (RuntimeException ex) {
            throw new FieldContractException(field, "时间格式无效");
        }
    }

    private static Instant parseNullableInstant(Object raw, String field) {
        if (raw == null || String.valueOf(raw).isBlank()) {
            return null;
        }
        return parseInstant(raw, field);
    }

    private static void validateTimeRange(Instant startsAt, Instant endsAt) {
        if (startsAt != null && endsAt != null && !endsAt.isAfter(startsAt)) {
            throw new FieldContractException("endsAt", "结束时间必须晚于开始时间");
        }
    }

    private static String normalizeReviewStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("status", "审核状态不能为空");
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACCEPTED", "APPROVED" -> "ACCEPTED";
            case "REJECTED", "DISMISSED" -> "REJECTED";
            default -> throw new FieldContractException("status", "审核状态无效");
        };
    }

    private static String normalizeObjectType(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException("objectType", "对象类型不能为空");
        }
        return raw.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimRequired(String raw, String field) {
        if (raw == null || raw.isBlank()) {
            throw new FieldContractException(field, "对象标识不能为空");
        }
        return raw.trim();
    }

    private static String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static boolean parseBoolean(Object raw, boolean defaultValue) {
        if (raw == null) {
            return defaultValue;
        }
        if (raw instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(raw));
    }
}
